
import { HomeIcon, Plug } from "lucide-react";
import MQTTTool from "./pages/Index.jsx";

/**
* Central place for defining the navigation items. Used for navigation components and routing.
*/
export const navItems = [
  {
    title: "MQTT工具",
    to: "/",
    icon: <Plug className="h-4 w-4" />,
    page: <MQTTTool />,
  },
];

