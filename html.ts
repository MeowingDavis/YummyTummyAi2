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
<body>
  <div>
    <!-- Sidebar for saved chats -->
    <aside id="desktopSidebar">
      <h2>Saved Chats</h2>
      <ul id="savedChats"></ul>
    </aside>
    <!-- Mobile Saved Chats Button -->
    <button class="mobile-saved-toggle" onclick="showMobileSavedChats()" style="display:none;">
      Saved Chats
    </button>
    <div id="mobileSavedModalBg"></div>
    <div id="mobileSavedModal">
      <div>
        <button onclick="hideMobileSavedChats()">&times;</button>
      </div>
      <h2>Saved Chats</h2>
      <ul id="mobileSavedChats"></ul>
    </div>
    <!-- Main chat area -->
    <div>
      <div>
        <h1>
          Yummy Tummy AI
        </h1>
        <div id="chatbox"></div>
        <div>
          <div>
            <textarea
              id="input"
              rows="1"
              placeholder="Type a recipe question..."
              autocomplete="off"
            ></textarea>
            <div>
              <button onclick="send()">Send</button>
              <button onclick="newChat()">New Chat</button>
              <button onclick="saveChat()">Save Chat</button>
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
        li.innerHTML =
          '<span>' + (chat.title ? chat.title : "Chat " + (idx + 1)) + '</span>' +
          '<span>' +
            '<button onclick="loadChat(' + idx + ')">Load</button>' +
            '<button onclick="deleteChat(' + idx + ')">Delete</button>' +
          '</span>';
        ul.appendChild(li);
      });
    }
    window.renderSavedChats = renderSavedChats;

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
        appendMessage("Chef", "Tip: For best results, ask about food, cooking, or list your ingredients!");
      }

      appendMessage("You", message);
      chatHistory.push({ role: "user", content: message });
      input.value = "";
      input.disabled = true;

      const greetings = ["hi", "hello", "hey", "greetings"];
      if (greetings.includes(lowerMsg)) {
        appendMessage("Chef", "Hello! Please ask a recipe question or list your ingredients.");
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
        appendMessage("Error", "Error: " + err.message);
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
      div.innerHTML = '<strong>' + sender + ':</strong> ' + text.replace(/\n/g, "<br>");
      chatbox.appendChild(div);
      chatbox.scrollTop = chatbox.scrollHeight;
    }

    function appendMarkdown(sender, markdown) {
      const div = document.createElement("div");
      div.innerHTML = '<strong>' + sender + ':</strong><br>' + marked.parse(markdown);
      chatbox.appendChild(div);
      chatbox.scrollTop = chatbox.scrollHeight;
    }

    // --- Mobile Saved Chats Modal Logic ---
    function showMobileSavedChats() {
      document.getElementById('mobileSavedModalBg').style.display = 'block';
      document.getElementById('mobileSavedModal').style.display = 'block';
      renderMobileSavedChats();
    }
    function hideMobileSavedChats() {
      document.getElementById('mobileSavedModalBg').style.display = 'none';
      document.getElementById('mobileSavedModal').style.display = 'none';
    }
    function renderMobileSavedChats() {
      const savedChats = getSavedChats();
      const ul = document.getElementById("mobileSavedChats");
      ul.innerHTML = "";
      savedChats.forEach((chat, idx) => {
        const li = document.createElement("li");
        li.innerHTML =
          '<span>' + (chat.title ? chat.title : "Chat " + (idx + 1)) + '</span>' +
          '<span>' +
            '<button onclick="loadChat(' + idx + ');hideMobileSavedChats()">Load</button>' +
            '<button onclick="deleteChat(' + idx + ');renderMobileSavedChats()">Delete</button>' +
          '</span>';
        ul.appendChild(li);
      });
    }

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
