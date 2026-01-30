"use client";

import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export type YouTubePlayerHandle = {
  replay: () => void;
  loadVideo: (videoId: string, start: number, end: number) => void;
};

type Props = {
  videoId: string;
  start: number;
  end: number;
};

const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(
  ({ videoId, start, end }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const timerRef = useRef<number | null>(null);

    const stopAtEnd = () => {
      if (!playerRef.current) return;
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = window.setInterval(() => {
        const current = playerRef.current?.getCurrentTime();
        if (current >= end) {
          playerRef.current.pauseVideo();
          clearInterval(timerRef.current!);
        }
      }, 200);
    };


    const createPlayer = () => {
      if (!containerRef.current) return;
      if (playerRef.current) return; // 既に作成済みなら作らない

      playerRef.current = new window.YT.Player(containerRef.current!, {
        height: "315",
        width: "100%",
        videoId,
        playerVars: {
          start: Math.floor(start),
          controls: 1,
          rel: 0,
        },
        events: {
          onReady: () => {},
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.PLAYING) stopAtEnd();
          },
        },
      });
    };

    // videoIdが変わった場合はloadVideoByIdで切り替え
    useEffect(() => {
      if (!playerRef.current) return;

      playerRef.current.loadVideoById({
        videoId,
        startSeconds: start,
        endSeconds: end,
      });
      stopAtEnd();
    }, [videoId, start, end]);

    useImperativeHandle(ref, () => ({
      replay() {
        if (!playerRef.current) return;
        playerRef.current.seekTo(start, true);
        playerRef.current.playVideo();
        stopAtEnd();
      },
      loadVideo(newId: string, newStart: number, newEnd: number) {
        if (!playerRef.current) return;
        playerRef.current.loadVideoById({
          videoId: newId,
          startSeconds: newStart,
          endSeconds: newEnd,
        });
        stopAtEnd();
      },
    }));

    useEffect(() => {
      if (!window.YT) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
        window.onYouTubeIframeAPIReady = createPlayer;
      } else {
        createPlayer();
      }

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, []);

    return <div ref={containerRef} />;
  }
);

export default YouTubePlayer;
