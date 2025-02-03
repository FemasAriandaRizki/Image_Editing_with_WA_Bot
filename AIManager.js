import {
  AutoModel,
  AutoProcessor,
  pipeline,
  RawImage,
} from "@xenova/transformers";
import sharp from 'sharp';

let classifierModel;
let bgRemovalModel;
let bgRemovalProcessor;

function progressCallback(data) {
  console.log("loading model", data);
}

export async function getIntent(message) {
  if (classifierModel === undefined) {
    classifierModel = await pipeline(
      "zero-shot-classification",
      "Xenova/mobilebert-uncased-mnli",
      {
        quantized: false,
        progress_callback: progressCallback,
      }
    );
  }

  const labels = ["greet", "remove", "replace"];
  const output = await classifierModel(message, labels);
  console.log(output);
  const intent = output.labels[0];
  return intent;
}

async function loadBGRemovalModel() {
  if (bgRemovalModel === undefined) {
    bgRemovalModel = await AutoModel.from_pretrained("briaai/RMBG-1.4", {
      config: {
        model_type: "custom",
      },
      progress_callback: progressCallback,
    });

    bgRemovalProcessor = await AutoProcessor.from_pretrained(
      "briaai/RMBG-1.4",
      {
        config: {
          do_normalize: true,
          do_pad: false,
          do_rescale: true,
          do_resize: true,
          image_mean: [0.5, 0.5, 0.5],
          feature_extractor_type: "ImageFeatureExtractor",
          image_std: [1, 1, 1],
          resample: 2,
          rescale_factor: 0.00392156862745098,
          size: {
            width: 1024,
            height: 1024,
          },
        },
        progress_callback: progressCallback,
      }
    );
  }
}

export async function removeBackground(imageURL) {
  await loadBGRemovalModel();
  const image = await RawImage.fromURL(imageURL);

  const { pixel_values } = await bgRemovalProcessor(image);
  const { output } = await bgRemovalModel({ input: pixel_values });
  const mask = await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(
    image.width,
    image.height
  );

  const imageData = image.data;
  const maskData = mask.data;

  const rgbaData = new Uint8ClampedArray(image.width * image.height * 4);
  for (let i = 0; i < image.width * image.height; i++) {
    rgbaData[i * 4] = imageData[i * 3];
    rgbaData[i * 4 + 1] = imageData[i * 3 + 1];
    rgbaData[i * 4 + 2] = imageData[i * 3 + 2];
    rgbaData[i * 4 + 3] = maskData[i];
  }

  const outputImage = sharp(Buffer.from(rgbaData), {
    raw: {
      width: image.width,
      height: image.height,
      channels: 4,
    },
  });

  await outputImage.toFile("images/bg-removed.png");
}
