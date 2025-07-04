import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sun, Moon, Plug, PlugZap, MessageSquare, History, Radio, Send } from 'lucide-react';
import mqtt from 'mqtt';

// 生成随机MQTT客户端ID
const generateMqttClientId = () => {
  const randomId = Math.random().toString(16).substr(2, 8);
  return 'mqtt_' + randomId; // 修改为字符串连接方式
};

// 封装$dp主题消息
const encapsulateDpMessage = (message) => {
  const encoder = new TextEncoder();
  const payload = encoder.encode(message);
  const length = payload.length;
  
  // 创建新数组：1字节类型 + 2字节长度 + 实际内容
  const encapsulated = new Uint8Array(3 + length);
  encapsulated[0] = 0x04; // 固定类型标识
  encapsulated[1] = (length >> 8) & 0xFF; // 长度高字节
  encapsulated[2] = length & 0xFF; // 长度低字节
  encapsulated.set(payload, 3); // 添加实际内容
  
  return encapsulated;
};

const MQTTTool = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [client, setClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('未连接');
  
  // 连接参数
  const [brokerUrl, setBrokerUrl] = useState('wss://broker.emqx.io:8084');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState(generateMqttClientId());
  const [keepAlive, setKeepAlive] = useState(120);
  const [cleanStart, setCleanStart] = useState(true);
  const [mqttVersion, setMqttVersion] = useState('5.0');
  
  // 遗嘱消息参数
  const [willTopic, setWillTopic] = useState('');
  const [willMessage, setWillMessage] = useState('');
  const [willQos, setWillQos] = useState('0');
  const [willRetain, setWillRetain] = useState(false);
  const [enableWill, setEnableWill] = useState(false);
  const [willPayloadType, setWillPayloadType] = useState('text');
  
  // 订阅参数
  const [topics, setTopics] = useState([]);
  const [newTopic, setNewTopic] = useState('');
  const [newTopicQos, setNewTopicQos] = useState('0');
  
  // 发布参数
  const [publishTopic, setPublishTopic] = useState('$test');
  const [publishMessage, setPublishMessage] = useState('');
  const [publishQos, setPublishQos] = useState('0');
  const [publishRetain, setPublishRetain] = useState(false);
  const [payloadType, setPayloadType] = useState('json');
  
  // 消息历史
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  // 切换主题
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 连接MQTT
  const connectToBroker = () => {
    setConnectionStatus('连接中...');
    
    const options = {
      username,
      password,
      clientId,
      keepalive: keepAlive,
      clean: cleanStart,
      reconnectPeriod: 0,
      rejectUnauthorized: false
    };
    
    // 设置MQTT版本
    if (mqttVersion === '3.1') {
      options.protocolVersion = 3;
    } else if (mqttVersion === '3.1.1') {
      options.protocolVersion = 4;
    } else if (mqttVersion === '5.0') {
      options.protocolVersion = 5;
    }
    
    // 添加遗嘱消息配置
    if (enableWill && willTopic && willMessage) {
      let willPayload = willMessage;
      if (willPayloadType === 'json') {
        try {
          willPayload = JSON.stringify(JSON.parse(willMessage));
        } catch (e) {
          console.error('遗嘱消息JSON解析错误:', e);
        }
      }
      
      options.will = {
        topic: willTopic,
        payload: willPayload,
        qos: parseInt(willQos),
        retain: willRetain
      };
    }
    
    const mqttClient = mqtt.connect(brokerUrl, options);
    
    mqttClient.on('connect', () => {
      setIsConnected(true);
      setConnectionStatus('已连接');
      
      topics.forEach(topic => {
        mqttClient.subscribe(topic.topic, { qos: parseInt(topic.qos) });
      });
    });
    
    mqttClient.on('message', (topic, message) => {
      const newMessage = {
        topic,
        payload: message.toString(),
        timestamp: new Date().toLocaleTimeString(),
        type: '订阅消息' // 标记为订阅消息
      };
      setMessages(prev => [...prev, newMessage]);
    });
    
    mqttClient.on('error', (err) => {
      setConnectionStatus(`错误: ${err.message}`);
      console.error('MQTT错误:', err);
    });
    
    mqttClient.on('close', () => {
      setIsConnected(false);
      setConnectionStatus('已断开');
    });
    
    setClient(mqttClient);
  };

  // 断开连接
  const disconnectFromBroker = () => {
    if (client) {
      client.end();
      setClient(null);
      setIsConnected(false);
      setConnectionStatus('已断开');
    }
  };

  // 添加订阅
  const addTopic = () => {
    if (newTopic.trim() === '') return;
    
    const topicExists = topics.some(t => t.topic === newTopic);
    if (topicExists) return;
    
    const newTopics = [...topics, { topic: newTopic, qos: newTopicQos }];
    setTopics(newTopics);
    
    if (client && isConnected) {
      client.subscribe(newTopic, { qos: parseInt(newTopicQos) });
    }
    
    setNewTopic('');
  };

  // 移除订阅
  const removeTopic = (topicToRemove) => {
    const newTopics = topics.filter(t => t.topic !== topicToRemove);
    setTopics(newTopics);
    
    if (client && isConnected) {
      client.unsubscribe(topicToRemove);
    }
  };

  // 发布消息
  const publishMessageToTopic = () => {
    if (!client || !isConnected || !publishTopic || !publishMessage) return;
    
    let payload = publishMessage;
    if (payloadType === 'json') {
      try {
        payload = JSON.stringify(JSON.parse(publishMessage));
      } catch (e) {
        console.error('JSON解析错误:', e);
      }
    }
    
    // 特殊处理$dp主题
    let finalPayload = payload;
    if (publishTopic === '$dp') {
      try {
        finalPayload = encapsulateDpMessage(payload);
        
        // 调试：打印二进制内容
        console.log('$dp主题二进制内容:', Array.from(finalPayload).map(b => b.toString(16).padStart(2, '0')).join(' '));
      } catch (e) {
        console.error('$dp消息封装失败:', e);
        return;
      }
    } else {
      // 调试：打印普通消息内容
      console.log('发布消息内容:', finalPayload);
    }
    
    client.publish(publishTopic, finalPayload, { 
      qos: parseInt(publishQos),
      retain: publishRetain 
    }, (err) => {
      if (err) {
        console.error('发布失败:', err);
      } else {
        const newMessage = {
          topic: publishTopic,
          payload: publishMessage,
          timestamp: new Date().toLocaleTimeString(),
          type: '发布消息' // 标记为发布消息
        };
        setMessages(prev => [...prev, newMessage]);
      }
    });
  };

  // 清空历史
  const clearHistory = () => {
    setMessages([]);
  };

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <div className="flex justify-between items-center p-6 border-b bg-white dark:bg-gray-800 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MQTT连接工具</h1>
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => setDarkMode(!darkMode)}
          aria-label="切换主题"
          className="hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex-1 container mx-auto p-6 max-w-6xl">
        <Card className="mb-8 shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plug className="h-5 w-5 text-blue-600 dark:text-blue-400" /> 连接设置
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="brokerUrl">服务器地址</Label>
                <Input
                  id="brokerUrl"
                  value={brokerUrl}
                  onChange={(e) => setBrokerUrl(e.target.value)}
                  placeholder="例如: wss://broker.emqx.io:8084"
                />
              </div>
              <div>
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="mqttVersion">MQTT版本</Label>
                <Select value={mqttVersion} onValueChange={setMqttVersion}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择版本" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3.1">MQTT 3.1</SelectItem>
                    <SelectItem value="3.1.1">MQTT 3.1.1</SelectItem>
                    <SelectItem value="5.0">MQTT 5.0</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="keepAlive">Keep Alive (秒)</Label>
                <Input
                  id="keepAlive"
                  type="number"
                  value={keepAlive}
                  onChange={(e) => setKeepAlive(Number(e.target.value))}
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="cleanStart" 
                    checked={cleanStart} 
                    onCheckedChange={setCleanStart} 
                  />
                  <Label htmlFor="cleanStart">Clean Start</Label>
                </div>
              </div>
            </div>
            
            {/* 遗嘱消息设置 */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center space-x-2 mb-4">
                <Switch 
                  id="enableWill" 
                  checked={enableWill} 
                  onCheckedChange={setEnableWill} 
                />
                <Label htmlFor="enableWill" className="font-medium">启用遗嘱消息</Label>
              </div>
              
              {enableWill && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="willTopic">遗嘱主题</Label>
                      <Input
                        id="willTopic"
                        value={willTopic}
                        onChange={(e) => setWillTopic(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="willQos">遗嘱QoS</Label>
                      <Select value={willQos} onValueChange={setWillQos}>
                        <SelectTrigger>
                          <SelectValue placeholder="QoS" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0</SelectItem>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="willRetain" 
                          checked={willRetain} 
                          onCheckedChange={setWillRetain} 
                        />
                        <Label htmlFor="willRetain">遗嘱Retain</Label>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="willMessage">遗嘱消息内容</Label>
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Label className="text-sm">Payload类型:</Label>
                        <Select value={willPayloadType} onValueChange={setWillPayloadType}>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">文本</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <textarea
                        id="willMessage"
                        value={willMessage}
                        onChange={(e) => setWillMessage(e.target.value)}
                        className="flex w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
                          <div className="flex items-center gap-4 mt-8">
                <Button 
                  onClick={isConnected ? disconnectFromBroker : connectToBroker}
                  className={`px-6 py-2 font-medium transition-all duration-200 ${
                    isConnected 
                      ? 'bg-red-500 hover:bg-red-600 shadow-lg hover:shadow-xl' 
                      : 'bg-green-500 hover:bg-green-600 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isConnected ? (
                    <>
                      <PlugZap className="h-4 w-4 mr-2" /> 断开连接
                    </>
                  ) : (
                    <>
                      <Plug className="h-4 w-4 mr-2" /> 连接
                    </>
                  )}
                </Button>
                <div className={`px-4 py-2 rounded-lg text-sm font-medium shadow-sm ${
                  isConnected 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700' : 
                    connectionStatus.includes('错误') 
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700' : 
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700'
                }`}>
                  {connectionStatus}
                </div>
              </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="h-full flex flex-col shadow-lg border-0">
            <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="h-5 w-5 text-green-600 dark:text-green-400" /> 订阅管理
            </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="mb-4 flex-1">
                <Label>当前订阅</Label>
                <div className="mt-2 space-y-2 h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 shadow-inner">
                  {topics.length === 0 ? (
                    <div className="text-gray-500 text-sm py-2 text-center h-full flex items-center justify-center">
                      无订阅主题
                    </div>
                  ) : (
                    topics.map((topic, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                        <div>
                          <span className="font-medium">{topic.topic}</span>
                          <span className="text-xs ml-2 text-gray-500">QoS: {topic.qos}</span>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => removeTopic(topic.topic)}
                        >
                          移除
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="md:col-span-2">
                  <Label htmlFor="newTopic">新主题</Label>
                  <Input
                    id="newTopic"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="输入订阅主题"
                  />
                </div>
                <div>
                  <Label htmlFor="newTopicQos">QoS</Label>
                  <Select value={newTopicQos} onValueChange={setNewTopicQos}>
                    <SelectTrigger>
                      <SelectValue placeholder="QoS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button 
                onClick={addTopic}
                className="mt-3 w-full"
                disabled={!newTopic.trim()}
              >
                添加订阅
              </Button>
            </CardContent>
          </Card>
          
          <Card className="h-full flex flex-col shadow-lg border-0">
            <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-lg">
              <Send className="h-5 w-5 text-purple-600 dark:text-purple-400" /> 消息发布
            </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1">
                <div>
                  <Label htmlFor="publishTopic">主题</Label>
                  <Input
                    id="publishTopic"
                    value={publishTopic}
                    onChange={(e) => setPublishTopic(e.target.value)}
                    placeholder="输入发布主题"
                  />
                  {publishTopic === '$dp' && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      注意：$dp主题消息将自动进行二进制封装
                    </p>
                  )}
                </div>
                
                <div className="flex-1">
                  <Label htmlFor="publishMessage">消息内容</Label>
                  <textarea
                    id="publishMessage"
                    value={publishMessage}
                    onChange={(e) => setPublishMessage(e.target.value)}
                    placeholder='输入消息内容'
                    className="flex w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {/* 添加协议参考提示 */}
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <a 
                      href="https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.pdf" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      参考mqtt-v5.0协议
                    </a>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <Label>Payload类型</Label>
                    <Select value={payloadType} onValueChange={setPayloadType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Payload" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="text">文本</SelectItem>
                        <SelectItem value="base64">Base64</SelectItem>
                        <SelectItem value="hex">Hex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>QoS</Label>
                    <Select value={publishQos} onValueChange={setPublishQos}>
                      <SelectTrigger>
                        <SelectValue placeholder="QoS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-end">
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="publishRetain" 
                        checked={publishRetain} 
                        onCheckedChange={setPublishRetain} 
                      />
                      <Label htmlFor="publishRetain">Retain</Label>
                    </div>
                  </div>
                </div>
                
                <Button 
                  onClick={publishMessageToTopic}
                  className="w-full"
                  disabled={!publishTopic || !publishMessage || !isConnected}
                >
                  发布消息
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Card className="mt-8 shadow-lg border-0">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-orange-600 dark:text-orange-400" /> 消息历史
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={clearHistory}
                className="hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                清空历史
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80 overflow-y-auto border rounded-lg shadow-inner">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  暂无消息
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {messages.map((msg, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-lg shadow-sm border ${
                        msg.type === '订阅消息' 
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' 
                          : 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700'
                      }`}
                    >
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{msg.topic}</span>
                                                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                          msg.type === '订阅消息' 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}>
                            {msg.type}
                          </span>
                        </div>
                        <span className="text-gray-500 dark:text-gray-400">{msg.timestamp}</span>
                      </div>
                      <div className="mt-1 text-sm break-all">
                        {msg.payload}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <footer className="py-6 text-center text-sm text-gray-500 dark:text-gray-400 border-t bg-white dark:bg-gray-800">
        <div className="container mx-auto">
          MQTT连接工具 © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
};

export default MQTTTool;
