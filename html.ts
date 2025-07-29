export default `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yummy Tummy AI</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Heroicons for modern SVG icons -->
  <script src="https://unpkg.com/heroicons@2.0.18/dist/heroicons.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white font-sans">
  <div class="flex w-full max-w-6xl mx-auto">
    <!-- Sidebar for saved chats -->
    <aside class="hidden md:block w-64 bg-slate-900/70 rounded-xl shadow-xl border border-slate-800 p-4 mr-4 backdrop-blur-lg" id="desktopSidebar">
      <h2 class="text-lg font-bold mb-4 text-emerald-400">Saved Chats</h2>
      <ul id="savedChats" class="space-y-2"></ul>
    </aside>
    <!-- Mobile Saved Chats Button -->
    <button class="fixed bottom-6 left-6 z-50 bg-slate-900/90 border border-slate-800 rounded-full px-4 py-2 text-emerald-400 font-semibold shadow flex items-center gap-2 md:hidden backdrop-blur-lg" onclick="showMobileSavedChats()" style="display:none;">
      <svg xmlns="http://www.w3.org/2000/svg" class="inline mr-1" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5v14l7-7 7 7V5a2 2 0 00-2-2H7a2 2 0 00-2 2z"/></svg>
      Saved
    </button>
    <div class="fixed inset-0 bg-black/60 z-40 hidden" id="mobileSavedModalBg"></div>
    <div class="fixed left-1/2 top-1/2 z-50 bg-slate-900 rounded-xl shadow-lg p-6 min-w-[80vw] max-w-[95vw] max-h-[80vh] overflow-y-auto hidden backdrop-blur-lg" id="mobileSavedModal" style="transform:translate(-50%,-50%)">
      <div class="flex justify-between items-center mb-3">
        <h2 class="text-lg font-bold text-emerald-400">Saved Chats</h2>
        <button onclick="hideMobileSavedChats()" class="text-white text-2xl leading-none px-2 py-1 rounded hover:bg-slate-800">&times;</button>
      </div>
      <ul id="mobileSavedChats" class="space-y-2"></ul>
    </div>
    <!-- Main chat area -->
    <div class="flex-1 flex flex-col">
      <div class="w-full max-w-3xl mx-auto bg-slate-900/80 rounded-xl shadow-xl border border-slate-800 p-6 sm:p-8 backdrop-blur-lg">
        <h1 class="text-3xl sm:text-4xl font-bold mb-6 text-center tracking-tight text-white">
          Yummy Tummy <span class="text-emerald-400">AI</span>
        </h1>
        <div id="chatbox" class="h-[70vh] min-h-[350px] max-h-[75vh] overflow-y-auto border border-slate-800 p-4 sm:p-6 bg-slate-800/60 rounded-lg space-y-4 text-base text-white/90 prose prose-invert prose-p:leading-relaxed"></div>
        <div class="flex gap-3 mt-6 items-end">
          <div class="flex-1 flex flex-row items-end gap-3 flex-wrap sm:flex-nowrap">
            <textarea
              id="input"
              rows="1"
              class="flex-1 bg-slate-800 text-white placeholder-slate-400 rounded-xl border border-emerald-400 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition resize-none shadow-lg"
              placeholder="Type a recipe question..."
              autocomplete="off"
              style="min-height: 48px; max-height: 220px; overflow-y:auto; width:100%;"
            ></textarea>
            <div class="flex flex-row gap-2 sm:gap-3 items-end flex-wrap sm:flex-nowrap w-full sm:w-auto">
              <button
                onclick="send()"
                class="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-5 py-3 shadow-lg transition h-12 min-w-[48px] flex items-center justify-center"
                title="Send"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12l14-7-7 14-2-5-5-2z"/>
                </svg>
              </button>
              <button
                onclick="newChat()"
                class="bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-xl px-5 py-3 shadow-lg transition h-12 min-w-[48px] flex items-center justify-center"
                title="New Chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
              </button>
              <button
                onclick="saveChat()"
                class="bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl px-5 py-3 shadow-lg transition h-12 min-w-[48px] flex items-center justify-center"
                title="Save Chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const chatbox = document.getElementById('chatbox');
    const input = document.getElementById('input');
    let chatHistory = [];

    // --- Saved Chats Sidebar Logic ---
    function getSavedChats() {
      return JSON.parse(localStorage.getItem("savedChats") || "[]");
    }
    function renderSavedChats() {
      const savedChats = getSavedChats();
      const ul = document.getElementById("savedChats");
      ul.innerHTML = "";
      savedChats.forEach((chat, idx) => {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between bg-[#232323] rounded px-2 py-1";
        li.innerHTML = \`
          <span class="truncate max-w-[120px]">\${chat.title || "Chat " + (idx + 1)}</span>
          <span>
            <button onclick="loadChat(\${idx})" class="text-emerald-400 hover:underline mr-2">Load</button>
            <button onclick="deleteChat(\${idx})" class="text-red-400 hover:underline">Delete</button>
          </span>
        \`;
        ul.appendChild(li);
      });
    }
    window.renderSavedChats = renderSavedChats; // for inline onclick

    function saveChat() {
      const title = prompt("Name this chat:", "Recipe Chat");
      if (!title) return;
      const savedChats = getSavedChats();
      savedChats.push({ title, history: chatHistory });
      localStorage.setItem("savedChats", JSON.stringify(savedChats));
      renderSavedChats();
    }
    window.saveChat = saveChat;

    function loadChat(idx) {
      const savedChats = getSavedChats();
      if (!savedChats[idx]) return;
      chatHistory = savedChats[idx].history || [];
      chatbox.innerHTML = "";
      for (const msg of chatHistory) {
        if (msg.role === "user") appendMessage("You", msg.content);
        else if (msg.role === "assistant") appendMarkdown("Chef", msg.content);
      }
    }
    window.loadChat = loadChat;

    function deleteChat(idx) {
      const savedChats = getSavedChats();
      savedChats.splice(idx, 1);
      localStorage.setItem("savedChats", JSON.stringify(savedChats));
      renderSavedChats();
    }
    window.deleteChat = deleteChat;

    // --- Chat Logic ---
    async function send() {
      const message = input.value.trim();
      if (!message) return;

      const allowedKeywords = [
        "cook", "recipe", "food", "ingredient", "bake", "grill", "fry", "boil", "meal", "dish", "kitchen", "dinner", "lunch", "breakfast", "snack", "dessert", "spice", "herb", "nutrition", "calorie", "vegan", "vegetarian", "meat", "fish", "sauce", "flavor", "taste", "garnish", "chef", "cuisine"
      ];
      const lowerMsg = message.toLowerCase();
      const isCookingRelated = allowedKeywords.some(word => lowerMsg.includes(word));
      if (!isCookingRelated && message.split(" ").length < 8) {
        appendMessage("Chef", "💡 Tip: For best results, ask about food, cooking, or list your ingredients!");
      }

      appendMessage("You", message);
      chatHistory.push({ role: "user", content: message });
      input.value = "";
      input.style.height = "48px";
      input.disabled = true;

      const greetings = ["hi", "hello", "hey", "greetings"];
      if (greetings.includes(lowerMsg)) {
        appendMessage("Chef", "👋 Hello! Please ask a recipe question or list your ingredients.");
        input.disabled = false;
        input.focus();
        return;
      }

      try {
        const res = await fetch("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });

        const data = await res.json();

        if (data.markdown) {
          appendMarkdown("Chef", data.markdown);
          chatHistory.push({ role: "assistant", content: data.markdown });
        } else if (data.reply) {
          appendMarkdown("Chef", data.reply);
          chatHistory.push({ role: "assistant", content: data.reply });
        }
      } catch (err) {
        appendMessage("Error", "❌ " + err.message);
      } finally {
        input.disabled = false;
        input.focus();
      }
    }

    async function newChat() {
      chatbox.innerHTML = "";
      chatHistory = [];
      input.value = "";
      input.disabled = false;
      input.focus();
      await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Let's start a new chat!", newChat: true }),
      });
    }

    function appendMessage(sender, text) {
      const div = document.createElement("div");
      div.innerHTML = \`<strong class="text-emerald-400">\${sender}:</strong> \${text.replace(/\\n/g, "<br>")}\`;
      chatbox.appendChild(div);
      chatbox.scrollTop = chatbox.scrollHeight;
    }

    function appendMarkdown(sender, markdown) {
      const div = document.createElement("div");
      div.innerHTML = \`<strong class="text-emerald-400">\${sender}:</strong><br>\` + marked.parse(markdown);
      div.classList.add("prose", "prose-invert", "max-w-none");
      chatbox.appendChild(div);
      chatbox.scrollTop = chatbox.scrollHeight;
    }

    // --- Mobile Saved Chats Modal Logic ---
    function showMobileSavedChats() {
      document.getElementById('mobileSavedModalBg').classList.add('active');
      document.getElementById('mobileSavedModal').classList.add('active');
      renderMobileSavedChats();
    }
    function hideMobileSavedChats() {
      document.getElementById('mobileSavedModalBg').classList.remove('active');
      document.getElementById('mobileSavedModal').classList.remove('active');
    }
    function renderMobileSavedChats() {
      const savedChats = getSavedChats();
      const ul = document.getElementById("mobileSavedChats");
      ul.innerHTML = "";
      savedChats.forEach((chat, idx) => {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between bg-[#232323] rounded px-2 py-1";
        li.innerHTML =
          '<span class="truncate max-w-[120px]">' + (chat.title ? chat.title : "Chat " + (idx + 1)) + '</span>' +
          '<span>' +
            '<button onclick="loadChat(' + idx + ');hideMobileSavedChats()" class="text-emerald-400 hover:underline mr-2">Load</button>' +
            '<button onclick="deleteChat(' + idx + ');renderMobileSavedChats()" class="text-red-400 hover:underline">Delete</button>' +
          '</span>';
        ul.appendChild(li);
      });
    }

    // Show mobile saved chats button on mobile
    function handleMobileSavedToggle() {
      const btn = document.querySelector('.mobile-saved-toggle');
      if (window.innerWidth <= 640) {
        btn.style.display = 'flex';
      } else {
        btn.style.display = 'none';
        hideMobileSavedChats();
      }
    }
    window.addEventListener('resize', handleMobileSavedToggle);
    window.addEventListener('DOMContentLoaded', handleMobileSavedToggle);

    // Hide modal when clicking background
    document.getElementById('mobileSavedModalBg').onclick = hideMobileSavedChats;

    // Auto-grow textarea and handle Shift+Enter for new lines, Enter to send
    input.addEventListener("input", () => {
      input.style.height = "48px";
      input.style.height = Math.min(input.scrollHeight, 220) + "px";
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
      // Shift+Enter inserts newline by default, so no need to handle
    });

    // Render saved chats on load
    renderSavedChats();
  </script>
</body>
</html>
`