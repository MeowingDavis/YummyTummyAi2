export default `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yummy Tummy AI</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <link rel="stylesheet" href="/static/styles.css" />
 
</head>
<body class="min-h-screen flex items-center justify-center text-white font-sans bg-[#101010]">
  <div class="flex w-full max-w-6xl mx-auto">
    <!-- Sidebar for saved chats -->
    <aside class="sidebar w-64 glass-sidebar border-r border-[#232323] p-4 hidden md:block" id="desktopSidebar">
      <h2 class="text-lg font-bold mb-4 text-emerald-400">Saved Chats</h2>
      <ul id="savedChats" class="space-y-2"></ul>
    </aside>
    <!-- Mobile Saved Chats Button -->
    <button class="mobile-saved-toggle" onclick="showMobileSavedChats()" style="display:none;">
      <svg xmlns="http://www.w3.org/2000/svg" class="inline mr-1" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5v14l7-7 7 7V5a2 2 0 00-2-2H7a2 2 0 00-2 2z"/></svg>
      Saved Chats
    </button>
    <div class="mobile-saved-modal-bg" id="mobileSavedModalBg"></div>
    <div class="mobile-saved-modal" id="mobileSavedModal">
      <div class="flex justify-end items-center mb-3">
        <button onclick="hideMobileSavedChats()" class="text-white text-2xl leading-none px-2 py-1 rounded hover:bg-[#232323]">&times;</button>
      </div>
      <h2 class="text-lg font-bold text-emerald-400 mb-2">Saved Chats</h2>
      <ul id="mobileSavedChats" class="space-y-2"></ul>
    </div>
    <!-- Main chat area -->
    <div class="flex-1 flex flex-col">
      <div class="w-full max-w-3xl mx-auto glass p-6 sm:p-8 shadow-xl border border-[#2a2a2a]">
        <h1 class="text-3xl sm:text-4xl font-bold mb-6 text-center tracking-tight text-white">
          Yummy Tummy <span class="text-emerald-400">AI</span>
        </h1>
        <div id="chatbox" class="h-[70vh] min-h-[350px] max-h-[75vh] overflow-y-auto border border-[#2f2f2f] p-4 sm:p-6 bg-[#1a1a1a]/60 glass space-y-4 text-base text-white/90 prose prose-invert prose-p:leading-relaxed"></div>
        <div class="flex gap-3 mt-6 items-end">
          <div class="flex-1 flex flex-row items-end gap-3 flex-wrap sm:flex-nowrap">
            <textarea
              id="input"
              rows="1"
              class="glass-input text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
              placeholder="Type a recipe question..."
              autocomplete="off"
              style="min-height: 48px; max-height: 220px; overflow-y:auto; width:100%;"
            ></textarea>
            <div class="flex flex-row gap-2 sm:gap-3 items-end flex-wrap sm:flex-nowrap w-full sm:w-auto">
              <button
                onclick="send()"
                class="glass-btn text-white font-semibold shadow transition h-12 px-6"
                style="border-radius:0.5rem; min-width:110px;"
              >
                Send
              </button>
              <button
                onclick="newChat()"
                class="glass-btn-dark text-white font-semibold shadow transition h-12 px-6"
                style="border-radius:0.5rem; min-width:110px;"
              >
                New Chat
              </button>
              <button
                onclick="saveChat()"
                class="glass-btn-blue text-white font-semibold shadow transition h-12 px-6"
                style="border-radius:0.5rem; min-width:110px;"
              >
                Save Chat
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
        li.innerHTML =
          '<span class="truncate max-w-[120px]">' + (chat.title ? chat.title : "Chat " + (idx + 1)) + '</span>' +
          '<span>' +
            '<button onclick="loadChat(' + idx + ')" class="text-emerald-400 hover:underline mr-2">Load</button>' +
            '<button onclick="deleteChat(' + idx + ')" class="text-red-400 hover:underline">Delete</button>' +
          '</span>';
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
`;
`;
`;
