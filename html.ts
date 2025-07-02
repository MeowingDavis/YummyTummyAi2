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
      /* Smoother, darker gradient with radial overlay for less banding */
      background:
        radial-gradient(ellipse at 60% 40%, rgba(30,30,30,0.7) 0%, rgba(20,20,20,0.95) 100%),
        linear-gradient(135deg, #181a1b 0%, #232526 60%, #101112 100%);
    }
    .glass {
      background: rgba(30, 30, 30, 0.70); /* more matte, less transparent */
      border-radius: 1.25rem;
      box-shadow: 0 4px 18px 0 rgba(31, 38, 135, 0.10); /* softer shadow */
      backdrop-filter: blur(8px) saturate(120%);
      -webkit-backdrop-filter: blur(8px) saturate(120%);
      border: 1.5px solid rgba(255, 255, 255, 0.10);
    }
    .glass-sidebar {
      background: rgba(24, 24, 24, 0.60); /* more matte */
      border-radius: 1rem;
      box-shadow: 0 2px 12px 0 rgba(31, 38, 135, 0.06);
      backdrop-filter: blur(6px) saturate(110%);
      -webkit-backdrop-filter: blur(6px) saturate(110%);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .glass-input {
      background: rgba(21, 21, 21, 0.88) !important;
      border: 1px solid rgba(52,211,153,0.18) !important;
      backdrop-filter: blur(4px) saturate(110%);
      -webkit-backdrop-filter: blur(4px) saturate(110%);
      padding: 0.75rem 1rem !important; /* less vertical padding for alignment */
      font-size: 1.08rem !important;
      border-radius: 0.5rem !important;
      box-shadow: 0 2px 8px 0 rgba(52,211,153,0.06);
      transition: border 0.2s, box-shadow 0.2s;
      resize: none;
      line-height: 1.5 !important;
      font-family: 'Inter', 'Segoe UI', 'Arial', sans-serif !important;
    }
    .glass-input::placeholder {
      color: #a3a3a3 !important;
      opacity: 1 !important;
      font-style: italic;
      font-size: 1.05rem;
      letter-spacing: 0.01em;
    }
    .glass-input:focus {
      border: 1px solid #34d399 !important;
      box-shadow: 0 0 0 3px rgba(52,211,153,0.18);
      background: rgba(21, 21, 21, 0.97) !important;
    }
    .glass-btn,
    .glass-btn-blue,
    .glass-btn-dark {
      border-radius: 0.5rem !important; /* less round for all buttons */
      background: rgba(52, 211, 153, 0.13) !important;
      border: 1.5px solid rgba(52, 211, 153, 0.18) !important;
      backdrop-filter: blur(2px) saturate(110%);
      -webkit-backdrop-filter: blur(2px) saturate(110%);
      transition: background 0.2s, border 0.2s;
    }
    .glass-btn:hover {
      background: rgba(52, 211, 153, 0.22) !important;
      border: 1.5px solid rgba(52, 211, 153, 0.28) !important;
    }
    .glass-btn-blue {
      background: rgba(59, 130, 246, 0.13) !important;
      border: 1.5px solid rgba(59, 130, 246, 0.18) !important;
      backdrop-filter: blur(2px) saturate(110%);
      -webkit-backdrop-filter: blur(2px) saturate(110%);
      transition: background 0.2s, border 0.2s;
    }
    .glass-btn-blue:hover {
      background: rgba(59, 130, 246, 0.22) !important;
      border: 1.5px solid rgba(59, 130, 246, 0.28) !important;
    }
    .glass-btn-dark {
      background: rgba(42, 42, 42, 0.16) !important;
      border: 1.5px solid rgba(255,255,255,0.07) !important;
      backdrop-filter: blur(2px) saturate(110%);
      -webkit-backdrop-filter: blur(2px) saturate(110%);
      transition: background 0.2s, border 0.2s;
    }
    .glass-btn-dark:hover {
      background: rgba(51, 51, 51, 0.22) !important;
      border: 1.5px solid rgba(255,255,255,0.13) !important;
    }
    @media (max-width: 900px) {
      .sidebar { display: none; }
    }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center text-white font-sans bg-[#101010]">
  <div class="flex w-full max-w-6xl mx-auto">
    <!-- Sidebar for saved chats -->
    <aside class="sidebar w-64 glass-sidebar border-r border-[#232323] p-4 hidden md:block">
      <h2 class="text-lg font-bold mb-4 text-emerald-400">Saved Chats</h2>
      <ul id="savedChats" class="space-y-2"></ul>
    </aside>
    <!-- Main chat area -->
    <div class="flex-1 flex flex-col">
      <div class="w-full max-w-3xl mx-auto glass p-6 sm:p-8 shadow-xl border border-[#2a2a2a]">
        <h1 class="text-3xl sm:text-4xl font-bold mb-6 text-center tracking-tight text-white">
          Yummy Tummy <span class="text-emerald-400">AI</span>
        </h1>
        <div id="chatbox" class="h-[70vh] min-h-[350px] max-h-[75vh] overflow-y-auto border border-[#2f2f2f] p-4 sm:p-6 bg-[#1a1a1a]/60 glass space-y-4 text-base text-white/90 prose prose-invert prose-p:leading-relaxed"></div>
        <div class="flex gap-3 mt-6 items-end">
          <div class="flex-1 flex flex-row items-end gap-3">
            <textarea
              id="input"
              rows="1"
              class="glass-input text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
              placeholder="Type a recipe question..."
              autocomplete="off"
              style="min-height: 48px; max-height: 220px; overflow-y:auto; width:100%;"
            ></textarea>
            <div class="flex flex-row gap-2 sm:gap-3 items-end">
              <button onclick="send()" class="glass-btn text-white font-semibold px-6 py-3 shadow transition" style="border-radius:0.5rem;">
                Send
              </button>
              <button onclick="newChat()" class="glass-btn-dark text-white font-semibold px-6 py-3 shadow transition" style="border-radius:0.5rem;">
                New Chat
              </button>
              <button onclick="saveChat()" class="glass-btn-blue text-white font-semibold px-6 py-3 shadow transition" style="border-radius:0.5rem;">
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
