import express from "express";
import bodyParser from "body-parser";
import twilio from "twilio";
import "dotenv/config";
import { getIntent, removeBackground } from "./AIManager.js";

const app = express();
const port = 3000;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const ngrokBaseURL = process.env.NGROK_BASE_URL;

const twilioClient = twilio(accountSid, authToken);
let intent = "";
let inputImageURL;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("images"));

app.listen(port, () => {
  console.log(`Express server running on port ${port}`);
});

function sendMessage(body, from, to, mediaUrl) {
  const payload =
    mediaUrl === "" ? { body, from, to } : { body, from, to, mediaUrl };

  twilioClient.messages
    .create(payload)
    .then((msg) => console.log(msg.sid))
    .catch((error) => {
      console.error("error", error);
    });
}

async function handleIncomingMessage(req) {
  const { To, Body, From } = req.body;
  let message = "";
  const outputImageURL = "";
  intent = await getIntent(Body);
  if (intent === "remove") {
    sendMessage("Removing background, please wait", To, From, "");
    await removeBackground(inputImageURL);
    message = `${ngrokBaseURL}/bg-removed.png`;
    const result = { message, outputImageURL };
    return result;
  } else if (intent === "replace") {
    message = "Please send the background image";
    const result = { message, outputImageURL };
    return result;
  } else if (intent === "greet") {
    message =
      "Hello there, I am chatbot that allows you to remove and replace an image background. Please send me an image to get started.";
    const result = { message, outputImageURL };
    return result;
  }
}

app.post("/incomingMessage", async (req, res) => {
  const { To, Body, From, MediaUrl0 } = req.body;
  let message = "";
  let outputImageURL = "";
  try {
    if (MediaUrl0 === undefined) {
      const result = await handleIncomingMessage(req);
      message = result.message;
      outputImageURL = result.outputImageURL;

      sendMessage(message, To, From, outputImageURL);
      return res.status(200);
    } else {
      message =
        intent !== "replace"
          ? "Image received. What would you like to do with it ?"
          : "Background image received please wait while I replace the background";
      inputImageURL = MediaUrl0;
      sendMessage(message, To, From, outputImageURL);
      return res.status(200);
    }
  } catch (error) {
    console.error("error", error);
  }
});
