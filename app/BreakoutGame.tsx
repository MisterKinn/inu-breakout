"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

type Screen = "START" | "COUNTDOWN" | "PLAYING" | "PAUSED" | "WON" | "LOST";
type Brick = { x: number; y: number; w: number; h: number; color: string; red: boolean; alive: boolean };
type RecordItem = { name: string; finishTime: string; milliseconds?: number };

const W = 720;
const H = 720;
const TARGET_RED = 3;
const COLORS = ["#ff9f43", "#ffd166", "#54a0ff", "#46d39a", "#a78bfa", "#d89b6b"];

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function numericTime(value: string) {
  const [m = "0", s = "0"] = value.split(":");
  return Number(m) * 60 + Number(s);
}

function makeBricks(): Brick[] {
  const redIndexes = new Set<number>();
  while (redIndexes.size < 12) redIndexes.add(Math.floor(Math.random() * 40));
  return Array.from({ length: 40 }, (_, i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    const red = redIndexes.has(i);
    return { x: 32 + col * 82, y: 88 + row * 40, w: 72, h: 27, red, alive: true, color: red ? "#ff5364" : COLORS[Math.floor(Math.random() * COLORS.length)] };
  });
}

export default function BreakoutGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<Screen>("START");
  const nameRef = useRef("");
  const rafRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const stateRef = useRef({ paddleX: W / 2 - 70, ballX: W / 2, ballY: H - 100, vx: 4.1, vy: -5.2, lives: 3, red: 0, bricks: makeBricks(), keys: { left: false, right: false } });

  const [screen, setScreenState] = useState<Screen>("START");
  const [name, setName] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [lives, setLives] = useState(3);
  const [redCount, setRedCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [recordState, setRecordState] = useState("");

  const setScreen = useCallback((next: Screen) => {
    screenRef.current = next;
    setScreenState(next);
  }, []);

  const loadRecords = useCallback(async () => {
    const local: RecordItem[] = JSON.parse(localStorage.getItem("inu-breakout-records") || "[]");
    try {
      const response = await fetch("/api/records", { cache: "no-store" });
      const remote = response.ok ? await response.json() : [];
      const data = Array.isArray(remote) && remote.length ? remote : local;
      setRecords(data.sort((a: RecordItem, b: RecordItem) => numericTime(a.finishTime) - numericTime(b.finishTime)).slice(0, 3));
    } catch { setRecords(local.slice(0, 3)); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadRecords, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const resetBall = useCallback(() => {
    const game = stateRef.current;
    game.paddleX = W / 2 - 70;
    game.ballX = W / 2;
    game.ballY = H - 100;
    game.vx = (Math.random() > .5 ? 1 : -1) * 4.1;
    game.vy = -5.2;
  }, []);

  const beginGame = useCallback(() => {
    const game = stateRef.current;
    game.bricks = makeBricks();
    game.lives = 3;
    game.red = 0;
    pausedTotalRef.current = 0;
    setLives(3); setRedCount(0); setElapsed(0); setRecordState("");
    resetBall();
    setCountdown(3);
    setScreen("COUNTDOWN");
    let value = 3;
    const timer = window.setInterval(() => {
      value -= 1;
      if (value === 0) {
        window.clearInterval(timer);
        startAtRef.current = performance.now();
        setScreen("PLAYING");
        audioRef.current?.play().catch(() => undefined);
      } else setCountdown(value);
    }, 700);
  }, [resetBall, setScreen]);

  const onStart = (event: FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    nameRef.current = clean;
    beginGame();
  };

  const finish = useCallback(async () => {
    const time = performance.now() - startAtRef.current - pausedTotalRef.current;
    const finishTime = formatTime(time);
    setElapsed(time);
    setScreen("WON");
    audioRef.current?.pause();
    const next = [...JSON.parse(localStorage.getItem("inu-breakout-records") || "[]"), { name: nameRef.current, finishTime, milliseconds: time }]
      .sort((a: RecordItem, b: RecordItem) => (a.milliseconds ?? numericTime(a.finishTime) * 1000) - (b.milliseconds ?? numericTime(b.finishTime) * 1000)).slice(0, 10);
    localStorage.setItem("inu-breakout-records", JSON.stringify(next));
    setRecords(next.slice(0, 3));
    setRecordState("기록 저장 중…");
    try {
      const response = await fetch("/api/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nameRef.current, finishTime }) });
      setRecordState(response.ok ? "기록 저장 완료" : "기기에 기록 저장됨");
      if (response.ok) loadRecords();
    } catch { setRecordState("기기에 기록 저장됨"); }
  }, [loadRecords, setScreen]);

  const hitSound = useCallback(() => {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.frequency.setValueAtTime(280, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + .08);
    gain.gain.setValueAtTime(.12, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .09);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .1);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const game = stateRef.current;
      ctx.clearRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, "#071a36"); grad.addColorStop(1, "#030817"); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = .3; ctx.fillStyle = "#65cfff"; for (let i = 0; i < 45; i++) ctx.fillRect((i * 137) % W, (i * 83) % H, 2, 2); ctx.globalAlpha = 1;
      for (const brick of game.bricks) if (brick.alive) {
        ctx.shadowColor = brick.color; ctx.shadowBlur = 10; ctx.fillStyle = brick.color; ctx.beginPath(); ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.34)"; ctx.fillRect(brick.x + 8, brick.y + 5, brick.w - 16, 3);
      }
      ctx.shadowBlur = 18; ctx.shadowColor = "#5ce1ff"; ctx.fillStyle = "#e7fbff"; ctx.beginPath(); ctx.roundRect(game.paddleX, H - 55, 140, 16, 8); ctx.fill();
      ctx.shadowColor = "#fff"; ctx.shadowBlur = 14; ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(game.ballX, game.ballY, 9, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      if (screenRef.current === "PLAYING") {
        if (game.keys.left) game.paddleX -= 8.5;
        if (game.keys.right) game.paddleX += 8.5;
        game.paddleX = Math.max(0, Math.min(W - 140, game.paddleX));
        game.ballX += game.vx; game.ballY += game.vy;
        if (game.ballX < 9 || game.ballX > W - 9) { game.vx *= -1; game.ballX = Math.max(9, Math.min(W - 9, game.ballX)); }
        if (game.ballY < 9) { game.vy = Math.abs(game.vy); game.ballY = 9; }
        if (game.vy > 0 && game.ballY + 9 >= H - 55 && game.ballY - 9 <= H - 39 && game.ballX >= game.paddleX && game.ballX <= game.paddleX + 140) {
          const offset = (game.ballX - (game.paddleX + 70)) / 70; game.vx = offset * 6.5; game.vy = -Math.abs(game.vy); game.ballY = H - 65;
        }
        for (const brick of game.bricks) if (brick.alive && game.ballX + 9 > brick.x && game.ballX - 9 < brick.x + brick.w && game.ballY + 9 > brick.y && game.ballY - 9 < brick.y + brick.h) {
          brick.alive = false; game.vy *= -1; hitSound();
          if (brick.red) { game.red += 1; setRedCount(game.red); if (game.red >= TARGET_RED) finish(); }
          break;
        }
        if (game.ballY > H + 12) {
          game.lives -= 1; setLives(game.lives);
          if (game.lives <= 0) { setScreen("LOST"); audioRef.current?.pause(); }
          else resetBall();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [finish, hitSound, resetBall, setScreen]);

  const togglePause = useCallback(() => {
    if (screenRef.current === "PLAYING") { pausedAtRef.current = performance.now(); setScreen("PAUSED"); audioRef.current?.pause(); }
    else if (screenRef.current === "PAUSED") { pausedTotalRef.current += performance.now() - pausedAtRef.current; setScreen("PLAYING"); audioRef.current?.play().catch(() => undefined); }
  }, [setScreen]);

  useEffect(() => {
    const tick = window.setInterval(() => { if (screenRef.current === "PLAYING") setElapsed(performance.now() - startAtRef.current - pausedTotalRef.current); }, 250);
    const key = (down: boolean) => (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft") stateRef.current.keys.left = down;
      if (event.key === "ArrowRight") stateRef.current.keys.right = down;
      if (down && event.key === " ") togglePause();
    };
    const kd = key(true), ku = key(false); window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { clearInterval(tick); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [togglePause]);

  const movePointer = (clientX: number) => {
    const canvas = canvasRef.current; if (!canvas || !["PLAYING", "PAUSED"].includes(screenRef.current)) return;
    const rect = canvas.getBoundingClientRect(); const x = (clientX - rect.left) * W / rect.width;
    stateRef.current.paddleX = Math.max(0, Math.min(W - 140, x - 70));
  };

  const goStart = () => { audioRef.current?.pause(); setScreen("START"); setName(""); loadRecords(); };

  return <div className="page-shell">
    <audio ref={audioRef} src="/Hyper_Speed_Run.mp3" loop preload="auto" />
    <section className="game-card">
      <header className="hud">
        <div><span className="eyebrow">INU ARCADE</span><strong>벽돌깨기</strong></div>
        <div className="stats"><span>❤ {lives}</span><span className="red-stat">◆ {redCount}/{TARGET_RED}</span><span>◷ {formatTime(elapsed)}</span></div>
      </header>
      <div className="stage" onPointerMove={(e) => movePointer(e.clientX)}>
        <canvas ref={canvasRef} width={W} height={H} aria-label="벽돌깨기 게임 화면" />
        {screen === "START" && <div className="overlay start-panel">
          <Image src="/Mascot.jpg" width={92} height={92} priority alt="인천대학교 마스코트 횃불이" />
          <span className="badge">2026 AI CODING MIDTERM</span>
          <h1>INU <em>BREAKOUT</em></h1>
          <p>빛나는 빨간 벽돌 3개를 깨고<br />최고 기록에 도전하세요!</p>
          <form onSubmit={onStart}>
            <label htmlFor="player-name">플레이어 이름</label>
            <input id="player-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="이름을 입력하세요" autoComplete="off" />
            <button className="primary" type="submit" disabled={!name.trim()}>▶ 게임 시작</button>
          </form>
          <div className="maker"><span>제작자</span><b>정보통신공학과 · 학번 입력 · 김성연</b></div>
          {records.length > 0 && <div className="ranking"><h2>🏆 TOP 3</h2>{records.map((r, i) => <div key={`${r.name}-${i}`}><span>{i + 1}. {r.name}</span><b>{r.finishTime}</b></div>)}</div>}
        </div>}
        {screen === "COUNTDOWN" && <div className="overlay countdown"><span>READY</span><strong key={countdown}>{countdown}</strong><p>방향키 또는 스와이프로 이동</p></div>}
        {screen === "PAUSED" && <div className="overlay modal"><span className="badge">BREAK TIME</span><h2>일시정지</h2><p>잠시 숨을 고르고 다시 시작하세요.</p><button className="primary" onClick={togglePause}>▶ 계속하기</button></div>}
        {screen === "LOST" && <div className="overlay modal"><span className="danger">MISSION FAILED</span><h2>GAME OVER</h2><p>공을 모두 놓쳤습니다. 다시 도전해 보세요!</p><button className="primary" onClick={beginGame}>↻ 다시 도전</button><button className="ghost" onClick={goStart}>처음 화면</button></div>}
        {screen === "WON" && <div className="overlay modal win"><div className="confetti">✦ ✧ ✦ ✧ ✦</div><span className="success">MISSION COMPLETE</span><h2>완벽합니다!</h2><strong className="finish-time">{formatTime(elapsed)}</strong><p>{name}님의 완주 기록</p><small>{recordState}</small><button className="primary" onClick={beginGame}>↻ 다시 도전</button><button className="ghost" onClick={goStart}>TOP 3 보기</button></div>}
      </div>
      {(screen === "PLAYING" || screen === "PAUSED") && <footer className="controls"><button onClick={togglePause}>{screen === "PAUSED" ? "▶ 계속" : "Ⅱ 멈춤"}</button><span>← → 키 / 화면 스와이프</span><button onClick={goStart}>■ 종료</button></footer>}
    </section>
  </div>;
}
