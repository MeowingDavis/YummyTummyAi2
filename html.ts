export default `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Groq LLaMA Chatbot</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#faf9f6] text-gray-900 font-sans p-4">
  <div class="max-w-xl mx-auto bg-[#faf9f6]/80 backdrop-blur-sm rounded-xl p-6 shadow-lg">
    <h1 class="text-2xl font-bold mb-4 text-center">🤖 Groq LLaMA Chatbot</h1>
    <div id="chatbox" class="h-96 overflow-y-auto border border-gray-200 p-4 rounded bg-[#faf9f6]/70 mb-4 space-y-2 text-sm"></div>
    <div class="flex space-x-2">
      <input
        id="input"
        type="text"
        class="flex-1 p-2 rounded border border-gray-300 bg-[#faf9f6]/50 text-gray-900 placeholder-gray-500"
        placeholder="Type a message..."
        autocomplete="off"
      />
      <button onclick="send()" class="bg-transparent border border-gray-300 hover:bg-gray-100 text-gray-900 px-4 py-2 rounded">
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
        appendMessage("Bot", data.reply);
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

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") send();
    });
  </script>
</body>
</html>
`;
