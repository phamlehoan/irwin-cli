import { createApp } from "vue";
import HelloIsland from "./components/HelloIsland.vue";

const el = document.getElementById("helloVueApp");
if (el) {
  const label = el.getAttribute("data-label") || "Irwin + Vue";
  createApp(HelloIsland, { label }).mount(el);
}
