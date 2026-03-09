// public/js/features/chat/uploads.js
import { state } from "./state.js";
import { hideTray } from "./ui.js";

export async function uploadAll(){
  if (!state.pendingFiles.length) return [];
  const form = new FormData();
  state.pendingFiles.forEach((f, i) => form.append('files', f, f.name || `image_${i}.png`));
  const res = await fetch('/upload', { method:'POST', body: form });
  if (!res.ok) throw new Error('Upload failed');
  const urls = await res.json();
  state.pendingFiles = [];
  hideTray();
  return urls;
}
