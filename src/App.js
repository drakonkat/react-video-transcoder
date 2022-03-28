import './App.css';
import VideoTranscoder from "./Screen/VideoTranscoder";
import {createFFmpeg} from "@ffmpeg/ffmpeg";

const ffmpeg = createFFmpeg({
  corePath: "ffmpeg-core.js",
  log: true,
});
function App() {
  return (
    <VideoTranscoder ffmpeg={ffmpeg}/>
  );
}

export default App;
