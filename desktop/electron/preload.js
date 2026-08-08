const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("graphloomDesktop", {
  isDesktop: true,
  platform: process.platform,
});
