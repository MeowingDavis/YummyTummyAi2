export default `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yummy Tummy Ai</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    body {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] text-gray-900 font-sans">
  <div class="w-full max-w-2xl mx-auto bg-white/60 backdrop-blur-lg rounded-3xl p-4 sm:p-8 shadow-2xl border border-white/40">
    <h1 class="text-3xl sm:text-4xl font-extrabold mb-6 text-center tracking-tight text-gray-800 drop-shadow">Yummy Tummy AI</h1>
    <div id="chatbox" class="h-[70vh] min-h-[350px] max-h-[75vh] overflow-y-auto border border-gray-200 p-4 sm:p-6 rounded-2xl bg-white/40 mb-6 space-y-4 text-base shadow-inner"></div>
    <div class="flex flex-col sm:flex-row gap-3">
      <input
        id="input"
        type="text"
        class="flex-1 p-3 rounded-xl border border-gray-300 bg-white/70 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff6b6b] transition"
        placeholder="Type a recipe question..."
        autocomplete="off"
      />
      <button onclick="send()" class="bg-[#ff6b6b] hover:bg-[#ff8787] text-white font-semibold px-6 py-3 rounded-xl shadow transition w-full sm:w-auto">
        Send
      </button>
    </div>
  </div>
  <script>
    const chatbox = document.getElementById('chatbox');
    const input = document.getElementById('input');

    async function send() {
      const message = input.value.trim();
      if (!message) return;

      // Gentle reminder if message doesn't seem food/cooking related
      const allowedKeywords = [
        "cook", "recipe", "food", "ingredient", "bake", "grill", "fry", "boil", "meal", "dish", "kitchen", "dinner", "lunch", "breakfast", "snack", "dessert", "spice", "herb", "nutrition", "calorie", "vegan", "vegetarian", "meat", "fish", "sauce", "flavor", "taste", "garnish", "chef", "cuisine"
      ];
      const lowerMsg = message.toLowerCase();
      const isCookingRelated = allowedKeywords.some(word => lowerMsg.includes(word));
      if (!isCookingRelated && message.split(" ").length < 8) {
        appendMessage("Chef", "Tip: For best results, ask about food, cooking, or list your ingredients!");
      }

      appendMessage("You", message);
      input.value = "";
      input.disabled = true;

      try {
        const res = await fetch("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });

        if (!res.ok) {
          appendMessage("Error", "Failed to get response");
          input.disabled = false;
          return;
        }

        const data = await res.json();
        if (data.markdown) {
          appendMarkdown("Chef", data.markdown);
        } else {
          appendMessage("Chef", data.reply);
        }
      } catch (err) {
        appendMessage("Error", err.message);
      } finally {
        input.disabled = false;
        input.focus();
      }
    }

    function appendMessage(sender, text) {
      const div = document.createElement("div");
      div.innerHTML = \`<strong>\${sender}:</strong> \${text.replace(/\\n/g, "<br>")}\`;
      chatbox.appendChild(div);
      chatbox.scrollTop = chatbox.scrollHeight;
    }

    function appendMarkdown(sender, markdown) {
      const div = document.createElement("div");
      div.innerHTML = \`<strong>\${sender}:</strong><br>\` + marked.parse(markdown);
      div.classList.add("prose", "max-w-none");
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