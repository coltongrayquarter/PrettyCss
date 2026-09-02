const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getArgument(name) {
  const index = process.argv.indexOf(name);

  if (index === -1 || !process.argv[index + 1]) {
    return null;
  }

  return process.argv[index + 1];
}

function printUsage() {
  console.log(`
Usage:

  node scripts/generate-theme.js --image <image-path> --html <html-path> [--output <css-path>]

Example:

  node scripts/generate-theme.js \\
    --image ./assets/reference.png \\
    --html ./src/components/form.html \\
    --output ./src/components/generated-theme.css
`);
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      throw new Error(
        `Unsupported image format: ${extension}. Use PNG, JPEG, WEBP, or GIF.`
      );
  }
}

function imageToDataUrl(imagePath) {
  const absolutePath = path.resolve(imagePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const mimeType = getMimeType(absolutePath);
  const image = fs.readFileSync(absolutePath);
  const base64 = image.toString('base64');

  return `data:${mimeType};base64,${base64}`;
}

async function main() {
  const imagePath = getArgument('--image');
  const htmlPath = getArgument('--html');
  const outputPath = getArgument('--output');

  if (!imagePath || !htmlPath) {
    printUsage();
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set.');
  }

  const absoluteHtmlPath = path.resolve(htmlPath);

  if (!fs.existsSync(absoluteHtmlPath)) {
    throw new Error(`HTML file not found: ${absoluteHtmlPath}`);
  }

  const html = fs.readFileSync(absoluteHtmlPath, 'utf8');
  const imageDataUrl = imageToDataUrl(imagePath);

  console.log('Analyzing image and HTML...');

  const response = await client.responses.create({
    model: 'gpt-5.6-luna',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `
You are an expert frontend designer and CSS engineer.

I am providing:

1. A reference image showing the visual design I want.
2. The HTML that will actually be rendered.

Your job is to create CSS that makes the supplied HTML visually match the reference image as closely as possible.

Analyze the reference image carefully, including:

- Primary colors
- Secondary colors
- Background colors
- Text colors
- Border colors
- Button colors
- Hover/active states where they can reasonably be inferred
- Typography
- Font sizes
- Font weights
- Border radius
- Borders
- Shadows
- Spacing
- Padding
- Layout
- Alignment
- Form controls
- Cards
- Headers
- Labels
- Inputs
- Buttons
- Links
- Overall visual hierarchy

Important requirements:

- Use the supplied HTML structure.
- Do not rewrite or modify the HTML.
- Do not invent a completely different component structure.
- Target the existing HTML elements and classes.
- Prefer existing class names when available.
- Use CSS variables for reusable colors.
- Match the colors in the image as closely as possible.
- If an exact color can be reasonably determined from the image, use that color.
- Do not use gradients unless the reference image clearly contains gradients.
- Do not add external dependencies.
- Do not use JavaScript.
- Do not include HTML.
- Do not include Markdown fences.
- Return ONLY valid CSS.

Here is the HTML:

${html}
            `.trim(),
          },
          {
            type: 'input_image',
            image_url: imageDataUrl,
          },
        ],
      },
    ],
  });

  const css = response.output_text
    .replace(/^```css\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!css) {
    throw new Error('OpenAI returned no CSS.');
  }

  if (outputPath) {
    const absoluteOutputPath = path.resolve(outputPath);

    fs.mkdirSync(path.dirname(absoluteOutputPath), {
      recursive: true,
    });

    fs.writeFileSync(absoluteOutputPath, css, 'utf8');

    console.log(`CSS written to: ${absoluteOutputPath}`);
  } else {
    console.log('\n--- Generated CSS ---\n');
    console.log(css);
  }
}

main().catch((error) => {
  console.error('\nError:', error.message);
  process.exit(1);
});
