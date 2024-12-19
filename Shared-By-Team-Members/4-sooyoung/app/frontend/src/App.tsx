import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Routes, Route, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { GroundingFiles } from "@/components/ui/grounding-files";
import GroundingFileView from "@/components/ui/grounding-file-view";
import StatusMessage from "@/components/ui/status-message";

import useRealTime from "@/hooks/useRealtime";
import useAudioRecorder from "@/hooks/useAudioRecorder";
import useAudioPlayer from "@/hooks/useAudioPlayer";

import { GroundingFile, ToolResult } from "./types";

import "./App.css";
import { CiMicrophoneOn } from "react-icons/ci";

// Link
import ChatHistory from "./ChatHistory.tsx"; // 대화 기록 페이지 추가

// 이미지 불러오기
import HomeImage from "./assets/home.png"; // 이미지 불러오기
import ChatImage from "./assets/chat.png";
import ScheduleImage from "./assets/schedule.png";
import SettingImage from "./assets/setting.png";
import LogoImage from "./assets/Dream_Logo.png";

import BottomCurve from "./BottomCurve";

function App() {
    const [computerReply, setComputerReply] = useState<string>(""); // 컴퓨터 답장 상태
    const [isRecording, setIsRecording] = useState(false);
    const [groundingFiles, setGroundingFiles] = useState<GroundingFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<GroundingFile | null>(null);
    const [animateGlow, setAnimateGlow] = useState(false);

    const { startSession, addUserAudio, inputAudioBufferClear } = useRealTime({
        onWebSocketOpen: () => console.log("WebSocket connection opened"),
        onWebSocketClose: () => console.log("WebSocket connection closed"),
        onWebSocketError: event => console.error("WebSocket error:", event),
        onReceivedError: message => console.error("error", message),
        onReceivedResponseAudioDelta: message => {
            isRecording && playAudio(message.delta);
            setComputerReply(prev => prev + message.delta); // 컴퓨터 답장 추가
        },
        onReceivedInputAudioBufferSpeechStarted: () => {
            stopAudioPlayer();
        },
        onReceivedExtensionMiddleTierToolResponse: message => {
            const result: ToolResult = JSON.parse(message.tool_result);

            const files: GroundingFile[] = result.sources.map(x => {
                return { id: x.chunk_id, name: x.title, content: x.chunk };
            });

            setGroundingFiles(prev => [...prev, ...files]);
        }
    });

    const { reset: resetAudioPlayer, play: playAudio, stop: stopAudioPlayer } = useAudioPlayer();
    const { start: startAudioRecording, stop: stopAudioRecording } = useAudioRecorder({ onAudioRecorded: addUserAudio });

    const onToggleListening = async () => {
        setAnimateGlow(!animateGlow);
        if (!isRecording) {
            setComputerReply(""); // 녹음을 시작할 때 컴퓨터의 답장을 초기화
            startSession();
            await startAudioRecording();
            resetAudioPlayer();

            setIsRecording(true);
        } else {
            await stopAudioRecording();
            stopAudioPlayer();
            inputAudioBufferClear();

            setIsRecording(false);
        }
    };

    const { t } = useTranslation();

    return (
        <div className="app">
            {/* 라우팅 영역 */}
            <Routes>
                {/* 메인 홈 페이지 */}
                <Route
                    path="/"
                    element={
                        <>
                            {/* 헤더 */}
                            <h1 className="header">
                                <img src={LogoImage} alt="로고" />
                                헤더 살펴드림
                            </h1>
                            {/* 자막 */}
                            <div className="subtitle">{computerReply || "대화를 시작해주세요."}</div>

                            {/* 곡선 애니메이션 */}
                            <BottomCurve animateGlow={isRecording} />

                            <Button
                                onClick={onToggleListening} // 기존 녹음 시작/중지 기능 유지
                                className="microphone-button" // 필요한 최소한의 스타일 클래스
                                aria-label={isRecording ? t("app.stopRecording") : t("app.startRecording")} // 접근성 레이블
                            >
                                <span className={`mic-icon ${isRecording ? "glow" : ""}`}>
                                    <CiMicrophoneOn />
                                </span>
                            </Button>

                            <StatusMessage isRecording={isRecording} />

                            {/* 2x2 버튼 레이아웃 */}
                            <div className="button-grid">
                                <Link to="/" className="grid-button">
                                    <img src={HomeImage} alt="홈" className="grid-image" />
                                </Link>
                                <Link to="/chat-history" className="grid-button">
                                    <img src={ChatImage} alt="대화 기록" className="grid-image" />
                                </Link>
                                <Link to="/" className="grid-button">
                                    <img src={ScheduleImage} alt="할 일" className="grid-image" />
                                </Link>
                                <Link to="/" className="grid-button">
                                    <img src={SettingImage} alt="설정" className="grid-image" />
                                </Link>
                            </div>
                        </>
                    }
                />
                {/* 대화 기록 페이지 */}
                <Route path="/chat-history" element={<ChatHistory />} />
            </Routes>

            {/* 파일 저장 */}
            <GroundingFiles files={groundingFiles} onSelected={setSelectedFile} />
            <GroundingFileView groundingFile={selectedFile} onClosed={() => setSelectedFile(null)} />
        </div>
    );
}

export default App;
