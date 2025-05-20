export default `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yummy Tummy Ai</title>
</head>
<body>
  <div id="container">
    <h1>Yummy Tummy AI</h1>
    <div id="chatbox"></div>
    <div id="message-form">
      <input id="input" type="text" placeholder="Type a message..." autocomplete="off" />
      <button onclick="send()">Send</button>
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