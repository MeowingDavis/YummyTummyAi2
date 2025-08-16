export default `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yummy Tummy AI</title>
  <link rel="stylesheet" href="/styles.css">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body>
  <div class="container">
    <!-- Sidebar for saved chats -->
    <aside class="sidebar" id="desktopSidebar">
      <h2>Saved Chats</h2>
      <ul class="saved-chats-list" id="savedChats"></ul>
    </aside>
    
    <!-- Mobile Saved Chats Button -->
    <button id="mobileMenuBtn" class="mobile-menu-btn" onclick="toggleMobileSavedChats()" aria-label="Show saved chats">
      <!-- Hamburger Icon -->
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/>
      </svg>
    </button>
    
    <div class="mobile-modal-bg" id="mobileSavedModalBg"></div>
    <div class="mobile-modal" id="mobileSavedModal">
      <div class="mobile-modal-header">
        <h2>Saved Chats</h2>
        <button onclick="hideMobileSavedChats()" class="mobile-modal-close" aria-label="Close">&times;</button>
      </div>
      <ul class="saved-chats-list" id="mobileSavedChats"></ul>
    </div>
    
    <!-- Main chat area -->
    <div class="main-chat">
      <div class="chat-container">
        <h1 class="chat-title">
          Yummy Tummy <span class="highlight">AI</span>
        </h1>
        <div id="chatbox" class="flex-1 min-h-[350px] max-h-[75vh] overflow-y-auto border border-slate-800 p-4 sm:p-6 bg-slate-800/60 rounded-lg space-y-4 text-base text-white/90 prose prose-invert prose-p:leading-relaxed"></div>
        <div class="flex gap-3 mt-6 items-end">
          <div class="flex-1 flex flex-row items-end gap-3 flex-wrap sm:flex-nowrap">
            <div style="display: flex; flex-direction: column-reverse; width: 100%;">
              <textarea
                id="input"
                class="input-field"
                rows="1"
                placeholder="Type a recipe question..."
                autocomplete="off"
              ></textarea>
              <div class="button-group">
                <button
                  onclick="send()"
                  class="btn btn-send"
                  title="Send"
                >
                  <!-- Paper Airplane Icon (Send) -->
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12l14-7-7 14-2-5-5-2z"/>
                  </svg>
                </button>
                <button
                  onclick="newChat()"
                  class="btn btn-new"
                  title="New Chat"
                >
                  <!-- Plus Icon (New Chat) -->
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                </button>
                <button
                  onclick="saveChat()"
                  class="btn btn-save"
                  title="Save Chat"
                >
                  <!-- Floppy Disk Icon (Save) -->
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 3v4h10V3"/>
                  </svg>
                </button>
              </div>
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
        li.className = "saved-chat-item";
        li.innerHTML = \`
          <span class="saved-chat-title">\${chat.title || "Chat " + (idx + 1)}</span>
          <span class="saved-chat-actions">
            <button onclick="loadChat(\${idx})" class="load-btn">Load</button>
            <button onclick="deleteChat(\${idx})" class="delete-btn">Delete</button>
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
      div.className = "message";
      div.innerHTML = \`<strong>\${sender}:</strong> \${text.replace(/\\n/g, "<br>")}\`;
      chatbox.appendChild(div);
      chatbox.scrollTop = chatbox.scrollHeight;
    }

    function appendMarkdown(sender, markdown) {
      const div = document.createElement("div");
      div.className = "message";
      div.innerHTML = \`<strong>\${sender}:</strong><br>\` + marked.parse(markdown);
      div.classList.add("prose", "prose-invert");
      chatbox.appendChild(div);
      chatbox.scrollTop = chatbox.scrollHeight;
    }

    // --- Mobile Saved Chats Modal Logic ---
    function toggleMobileSavedChats() {
      const modalBg = document.getElementById('mobileSavedModalBg');
      const modal = document.getElementById('mobileSavedModal');
      const isOpen = modal.style.display === 'block';
      if (isOpen) {
        modalBg.classList.remove('active');
        modal.classList.remove('active');
        modalBg.style.display = 'none';
        modal.style.display = 'none';
      } else {
        modalBg.classList.add('active');
        modal.classList.add('active');
        modalBg.style.display = 'block';
        modal.style.display = 'block';
        renderMobileSavedChats();
      }
    }
    function showMobileSavedChats() {
      // Deprecated, use toggleMobileSavedChats
      toggleMobileSavedChats();
    }
    function hideMobileSavedChats() {
      const modalBg = document.getElementById('mobileSavedModalBg');
      const modal = document.getElementById('mobileSavedModal');
      modalBg.classList.remove('active');
      modal.classList.remove('active');
      modalBg.style.display = 'none';
      modal.style.display = 'none';
    }
    function renderMobileSavedChats() {
      const savedChats = getSavedChats();
      const ul = document.getElementById("mobileSavedChats");
      ul.innerHTML = "";
      savedChats.forEach((chat, idx) => {
        const li = document.createElement("li");
        li.className = "saved-chat-item";
        li.innerHTML =
          '<span class="saved-chat-title">' + (chat.title ? chat.title : "Chat " + (idx + 1)) + '</span>' +
          '<span class="saved-chat-actions">' +
            '<button onclick="loadChat(' + idx + ');hideMobileSavedChats()" class="load-btn">Load</button>' +
            '<button onclick="deleteChat(' + idx + ');renderMobileSavedChats()" class="delete-btn">Delete</button>' +
          '</span>';
        ul.appendChild(li);
      });
    }

    // Show hamburger button only on mobile
    function handleMobileSavedToggle() {
      const btn = document.getElementById('mobileMenuBtn');
      if (window.innerWidth <= 640) {
        btn.style.display = 'flex';
      } else {
        btn.style.display = 'none';
        hideMobileSavedChats();
      }
      if (window.innerWidth > 640) {
        document.getElementById('mobileSavedModalBg').style.display = 'none';
        document.getElementById('mobileSavedModal').style.display = 'none';
      }
    }
    window.addEventListener('resize', handleMobileSavedToggle);
    window.addEventListener('DOMContentLoaded', handleMobileSavedToggle);

    document.getElementById('mobileSavedModalBg').onclick = hideMobileSavedChats;

<<<<<<< HEAD
    // Auto-grow textarea and shrink chatbox as input grows, moving textarea up
    input.addEventListener("input", () => {
      input.style.height = "48px";
      input.style.height = Math.min(input.scrollHeight, 220) + "px";
      // Shrink chatbox height as input grows
      const chatboxDiv = document.getElementById("chatbox");
      const baseChatboxHeight = 0.7 * window.innerHeight; // 70vh
      const inputHeight = input.scrollHeight;
      const maxInputHeight = 220;
      const usedHeight = Math.min(inputHeight, maxInputHeight) - 48;
      chatboxDiv.style.height = `calc(${baseChatboxHeight}px - ${usedHeight}px)`;
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