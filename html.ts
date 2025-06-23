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
  </style>
</head>
<body class="min-h-screen flex items-center justify-center text-white font-sans">
  <div class="w-full max-w-3xl mx-auto bg-white/5 backdrop-blur-md rounded-3xl p-6 sm:p-10 shadow-2xl border border-white/10">
    <h1 class="text-3xl sm:text-5xl font-bold mb-8 text-center tracking-tight text-white drop-shadow-md">
      Yummy Tummy <span class="text-emerald-400">AI</span>
    </h1>
    <div id="chatbox" class="h-[70vh] min-h-[350px] max-h-[75vh] overflow-y-auto border border-white/10 p-4 sm:p-6 rounded-2xl bg-white/5 shadow-inner space-y-4 text-base text-white/90 prose prose-invert prose-p:leading-relaxed">
    </div>
    <div class="flex flex-col sm:flex-row gap-3 mt-6">
      <input
        id="input"
        type="text"
        class="flex-1 p-3 rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
        placeholder="Type a recipe question..."
        autocomplete="off"
      />
      <button onclick="send()" class="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-xl shadow transition w-full sm:w-auto">
        Send
      </button>
      <button onclick="newChat()" class="bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl shadow transition w-full sm:w-auto">
        New Chat
      </button>
    </div>
  </div>
  <script>
    const chatbox = document.getElementById('chatbox');
    const input = document.getElementById('input');
    let chatHistory = [];

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
  </script>
</body>
</html>
`;
