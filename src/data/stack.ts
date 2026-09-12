/**
 * The stack, taken verbatim from Gabe's GitHub profile README
 * (github.com/Gabe-Mills/Gabe-Mills), 11 Sep 2026 — same five groups, same
 * order, same items, nothing added or dropped.
 *
 * Colours: the README badges default to #C4783A, which is already almost
 * exactly this site's ember, so chips inherit the site accent by default. The
 * handful of items he gave explicit brand colours keep them — that choice was
 * his, and it's what makes the Claude/OpenAI/NVIDIA groupings legible at a
 * glance. Everything else stays neutral so the accents mean something.
 */

export interface Chip {
  label: string;
  /** only where the README specified a brand colour */
  accent?: string;
}

export interface StackGroup {
  title: string;
  items: Chip[];
  /** optional trailing link, as in the README's "· gpu-benchmark" */
  link?: { label: string; url: string };
}

const OPENAI = "#412991";
const ANTHROPIC = "#D97757";
const NVIDIA = "#76B900";
const GOOGLE_AI = "#8E75B2";
// The README gave Cursor, Grok and Ollama #000. As a pill dot that could be
// substituted with a grey; as a word in the type index a grey term reads as
// "lesser", which is not what a black brand mark means. They stay neutral.

export const stack: StackGroup[] = [
  {
    title: "Languages",
    items: [
      { label: "Python" },
      { label: "Java" },
      { label: "C" },
      { label: "C++" },
      { label: "C#" },
      { label: "TypeScript" },
      { label: "JavaScript" },
      { label: "Swift" },
      { label: "HTML" },
      { label: "CSS" },
      { label: "Ruby" },
      { label: "Bash" },
    ],
  },
  {
    title: "Libraries & tools",
    items: [
      { label: "React" },
      { label: "Three.js" },
      { label: "Node" },
      { label: "Linux" },
      { label: "Docker" },
      { label: "Git" },
      { label: "Apple" },
      { label: "Cloudflare" },
      { label: "Blender" },
      { label: "PyTorch" },
      { label: "VS Code" },
      { label: "Nginx" },
      { label: "SwiftUI" },
      { label: "CUDA", accent: NVIDIA },
      { label: "vLLM" },
      { label: "SGLang" },
      { label: "ComfyUI" },
      { label: "Homebrew" },
    ],
  },
  {
    title: "AI I use every day",
    items: [
      { label: "Cursor" },
      { label: "Claude", accent: ANTHROPIC },
      { label: "Claude Code", accent: ANTHROPIC },
      { label: "ChatGPT", accent: OPENAI },
      { label: "Codex", accent: OPENAI },
      { label: "Grok" },
      { label: "Gemini", accent: GOOGLE_AI },
      { label: "Ollama" },
    ],
  },
  {
    title: "Models we've actually run",
    link: { label: "gpu-benchmark", url: "https://github.com/Massed-Compute/gpu-benchmark" },
    items: [
      { label: "Qwen" },
      { label: "Llama" },
      { label: "DeepSeek" },
      { label: "GLM", accent: "#1A73E8" },
      { label: "Nemotron", accent: NVIDIA },
      { label: "gpt-oss", accent: OPENAI },
      { label: "MiniMax" },
      { label: "LTX" },
      { label: "Spark" },
      { label: "FLUX" },
      { label: "Ideogram" },
      { label: "LFM" },
      { label: "Solar" },
      { label: "MiniCPM" },
      { label: "Kling" },
      { label: "Higgsfield" },
      { label: "Fooocus" },
      { label: "Krea" },
      { label: "Muse Glimmer" },
      { label: "Ornith" },
      { label: "Laguna" },
      { label: "Nanbeige" },
      { label: "Motif" },
      { label: "Mage" },
      { label: "SenseNova" },
      { label: "Bonsai" },
      { label: "HY3" },
    ],
  },
  {
    title: "Devices",
    items: [
      { label: "Mac" },
      { label: "iPhone" },
      { label: "Linux" },
      { label: "L40S", accent: NVIDIA },
      { label: "A100", accent: NVIDIA },
      { label: "A6000", accent: NVIDIA },
      { label: "H100", accent: NVIDIA },
      { label: "H200", accent: NVIDIA },
      { label: "Blackwell", accent: NVIDIA },
      { label: "3D printer" },
    ],
  },
];

export const stackCount = stack.reduce((n, g) => n + g.items.length, 0);
