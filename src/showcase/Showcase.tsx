import "./showcase.css";
import Stack from "./Stack";
import BackCover from "./BackCover";

/**
 * The portfolio after the engraved story. The cover (#top), the four projects (#work)
 * and GitHub (#github, "the code, in public") are beats inside the WebGL scroll story
 * (src/intro/beats.js), so this picks up where the canvas fades to ground: Stack and
 * the back cover. Content comes from src/data, the same files the original site reads.
 */
export default function Showcase() {
  return (
    <div className="sc">
      <Stack />
      <BackCover />
    </div>
  );
}
