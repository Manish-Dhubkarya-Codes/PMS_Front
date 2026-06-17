import { useRef, useState, useEffect } from "react";
import { FaPlay, FaPause } from "react-icons/fa";
import { MdSpeed } from "react-icons/md";

const speeds = [0.75, 1, 1.25, 1.5, 2];

export default function GamingAudioPlayer({ src }: { src: string; name?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressContainerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress(audio.currentTime);
      setDuration(audio.duration || 0);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setProgress(0);
      setError(null);
    };

    const handleError = () => {
      setError("Failed to load audio");
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("error", handleError);

    // Force reload metadata for new src
    audio.load();

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("error", handleError);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        setError(err);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressContainerRef.current || !audioRef.current || !duration) return;
    const rect = progressContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    audioRef.current.currentTime = newTime;
    setProgress(newTime);
  };

  const handleSpeedChange = (speed: number) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = speed;
    setPlaybackRate(speed);
  };

  // const formatTime = (time: number) => {
  //   if (isNaN(time) || time === 0) return "0:00";
  //   const m = Math.floor(time / 60);
  //   const s = Math.floor(time % 60);
  //   return `${m}:${s < 10 ? "0" + s : s}`;
  // };

  return (
    <div className="max-w-md mx-auto py-2 px-4 bg-gradient-to-br from-[#daefff] to-[#4885ef] rounded-xl shadow-xl border border-[#3a3a5c] text-white space-y-3 font-mono">
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onEnded={() => setIsPlaying(false)}
        onError={() => setError("Failed to load audio")}
      />
      {error && <div className="text-red-400 text-xs">{error}</div>}
      <div className="flex gap-x-4 justify-between items-center">
        <div
          onClick={togglePlay}
          className="bg-blue-600 cursor-pointer hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition"
        >
          {isPlaying ? <FaPause /> : <FaPlay />}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MdSpeed />
          <select
            value={playbackRate}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="bg-[#2f2f4f] border border-gray-600 text-white px-2 py-1 rounded"
          >
            {speeds.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* {name && <div className="truncate text-sm text-gray-400">{name}</div>} */}
      <div
        ref={progressContainerRef}
        className="w-full h-3 bg-[#2a2a3a] rounded-full cursor-pointer relative"
        onClick={handleProgressClick}
      >
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-red-500 to-green-500 shadow-[0_0_10px_rgba(255,255,255,0.3)]"
          style={{ width: `${(progress / (duration || 1)) * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-white">
        {/* <span>{formatTime(progress)}</span>
        <span>{formatTime(duration)}</span> */}
      </div>
    </div>
  );
}