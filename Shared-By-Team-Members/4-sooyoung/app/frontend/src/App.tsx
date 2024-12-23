import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Routes, Route, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { GroundingFiles } from "@/components/ui/grounding-files";
import GroundingFileView from "@/components/ui/grounding-file-view";

import useRealTime from "@/hooks/useRealtime";
import useAudioRecorder from "@/hooks/useAudioRecorder";
import useAudioPlayer from "@/hooks/useAudioPlayer";

import { GroundingFile, ToolResult } from "./types";

import "./App.css";
import { CiMicrophoneOn } from "react-icons/ci";

// Link
import ChatHistory from "./ChatHistory.tsx"; // 대화 기록 페이지 추가
import TodoPage from "./Pages/TodoPage.tsx"; // 할 일 페이지 추가
import Setting from "./Pages/setting.tsx"; // 설정 페이지

// 이미지 불러오기
import HomeImage from "./assets/home.png"; // 이미지 불러오기
import ChatImage from "./assets/chat.png";
import ScheduleImage from "./assets/schedule.png";
import SettingImage from "./assets/setting.png";
import LogoImage from "./assets/Dream_Logo.png";

import BottomCurve from "./BottomCurve";

function App() {
    const [isRecording, setIsRecording] = useState(false);
    const [groundingFiles, setGroundingFiles] = useState<GroundingFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<GroundingFile | null>(null);

    const { startSession, addUserAudio, inputAudioBufferClear } = useRealTime({
        onWebSocketOpen: () => console.log("WebSocket connection opened"),
        onWebSocketClose: () => console.log("WebSocket connection closed"),
        onWebSocketError: event => console.error("WebSocket error:", event),
        onReceivedError: message => console.error("error", message),
        onReceivedResponseAudioDelta: message => {
            isRecording && playAudio(message.delta); // 기존 음성 재생 유지
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
        if (!isRecording) {
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
            <div className="page-content">
                <Routes>
                    <Route
                        path="/"
                        element={
                            <div>
                                {/* 헤더 */}
                                <h1 className="header">
                                    <img src={LogoImage} alt="로고" />
                                    살펴 - 드림
                                </h1>
                                {/* 자막 */}
                                <div className="subtitle">대화를 시작해주세요</div>
                            </div>
                        }
                    />
                    <Route path="/chat-history" element={<ChatHistory />} />
                    <Route path="/TodoPage" element={<TodoPage />} />
                    <Route path="/setting" element={<Setting />} />
                </Routes>
            </div>

            {/* 네비게이션 바 */}
            <div className="button-grid">
                <Link to="/" className="grid-button">
                    <img src={HomeImage} alt="홈" className="grid-image" />
                </Link>
                <Link to="/chat-history" className="grid-button">
                    <img src={ChatImage} alt="대화 기록" className="grid-image" />
                </Link>

                <Link to="/TodoPage" className="grid-button">
                    <img src={ScheduleImage} alt="할 일" className="grid-image" />
                </Link>

                <Link to="/setting" className="grid-button">
                    <img src={SettingImage} alt="설정" className="grid-image" />
                </Link>
            </div>
            {/* 마이크 버튼 */}
            <Button onClick={onToggleListening} className="microphone-button" aria-label={isRecording ? t("app.stopRecording") : t("app.startRecording")}>
                <span className={`mic-icon ${isRecording ? "glow" : ""}`}>
                    <CiMicrophoneOn />
                </span>
            </Button>
            {/* 곡선 애니메이션 */}
            <BottomCurve animateGlow={isRecording} />

            <GroundingFiles files={groundingFiles} onSelected={setSelectedFile} />
            <GroundingFileView groundingFile={selectedFile} onClosed={() => setSelectedFile(null)} />
        </div>
    );
}

export default App;
