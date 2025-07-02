export default `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yummy Tummy AI</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    body {
      background: linear-gradient(to bottom right, #1e1e1e, #2a2a2a);
    }
    @media (max-width: 900px) {
      .sidebar { display: none; }
    }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center text-white font-sans bg-[#101010]">
  <div class="flex w-full max-w-6xl mx-auto">
    <!-- Sidebar for saved chats -->
    <aside class="sidebar w-64 min-h-[70vh] bg-gradient-to-b from-[#23272f] to-[#18181c] border-r border-[#232323] p-4 rounded-l-3xl shadow-2xl hidden md:flex flex-col gap-4">
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2h5m6-16v4m0 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <h2 class="text-lg font-bold text-emerald-400 tracking-wide">Saved Chats</h2>
      </div>
      <ul id="savedChats" class="space-y-3 flex-1 overflow-y-auto pr-1"></ul>
      <div class="text-xs text-gray-400 text-center mt-2">Your saved recipe chats appear here</div>
    </aside>
    <!-- Main chat area -->
    <div class="flex-1 flex flex-col">
      <div class="w-full max-w-3xl mx-auto bg-[#1e1e1e] p-6 sm:p-8 shadow-xl border border-[#2a2a2a]">
        <h1 class="text-3xl sm:text-4xl font-bold mb-6 text-center tracking-tight text-white">
          Yummy Tummy <span class="text-emerald-400">AI</span>
        </h1>
        <div id="chatbox" class="h-[70vh] min-h-[350px] max-h-[75vh] overflow-y-auto border border-[#2f2f2f] p-4 sm:p-6 bg-[#1a1a1a] space-y-4 text-base text-white/90 prose prose-invert prose-p:leading-relaxed"></div>
        <div class="flex flex-col sm:flex-row gap-3 mt-6">
          <input
            id="input"
            type="text"
            class="flex-1 p-3 border border-[#2f2f2f] bg-[#151515] text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            placeholder="Type a recipe question..."
            autocomplete="off"
          />
          <button onclick="send()" class="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 shadow transition w-full sm:w-auto">
            Send
          </button>
          <button onclick="newChat()" class="bg-[#2a2a2a] hover:bg-[#333] text-white font-semibold px-6 py-3 shadow transition w-full sm:w-auto">
            New Chat
          </button>
          <button onclick="saveChat()" class="bg-blue-500 hover:bg-blue-400 text-white font-semibold px-6 py-3 shadow transition w-full sm:w-auto">
            Save Chat
          </button>
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
        li.className = "flex items-center justify-between bg-[#232323] hover:bg-[#23272f] rounded-xl px-3 py-2 shadow transition-all duration-150 border border-[#262a32]";
        li.innerHTML = \`
          <span class="truncate max-w-[120px] font-medium text-white/90">\${chat.title || "Chat " + (idx + 1)}</span>
          <span class="flex gap-1">
            <button onclick="loadChat(\${idx})" class="rounded px-2 py-1 text-xs bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition">Load</button>
            <button onclick="deleteChat(\${idx})" class="rounded px-2 py-1 text-xs bg-red-500 hover:bg-red-400 text-white font-semibold transition">Delete</button>
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

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") send();
    });

    // Render saved chats on load
    renderSavedChats();
  </script>
</body>
</html>
`;
