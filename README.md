# Yummy Tummy AI

Yummy Tummy AI is a modern, mobile-friendly web app that helps you generate creative recipes using only the ingredients you provide. It can also pull from a collection of existing recipes stored as `.txt` files.

## Features

- **Recipe-Only Chatbot:** Only answers questions about recipes or cooking.
- **Ingredient-Constrained:** Will not add or assume ingredients you didn't list.
- **Existing Recipe Search:** Checks your local `.txt` recipe files for matches before using AI.
- **Session Memory:** Remembers your chat during a session, but clears memory on page refresh.
- **Modern UI:** Sleek, glassmorphism-inspired interface, fully responsive for mobile and desktop.
- **Privacy:** No user accounts or tracking.

## Usage

1. **Start the server:**  
   Make sure you have [Deno](https://deno.com/) installed and set your `GROQ_API_KEY` environment variable.
   ```sh
   export GROQ_API_KEY=your_groq_api_key
   deno run --allow-net --allow-read --allow-env main.ts
   ```
2. **Open in your browser:**  
   Visit [http://localhost:8000](http://localhost:8000).

3. **Ask for recipes:**  
   - Type a recipe-related question or list your ingredients.
   - The bot will reply with a recipe using only your ingredients, or pull from your `.txt` recipes if there's a match.

## Recipe Files

- Place your `.txt` recipe files in a `recipes/` directory at the project root.
- The app will search these files for matches based on your chat input.

## Project Structure

```
/main.ts         # Deno server and chat logic
/html.ts         # Frontend HTML and UI
/recipes/        # (Optional) Your .txt recipe files
/.gitattributes  # Git settings
```

## Customization

- **AI Model:** Change the model in `main.ts` if desired.
- **UI:** Edit `html.ts` for further style tweaks.

## License

MIT License
