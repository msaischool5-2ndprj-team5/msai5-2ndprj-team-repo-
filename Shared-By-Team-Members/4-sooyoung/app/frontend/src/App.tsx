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
import ChatHistory from "./Pages/ChatHistory.tsx"; // 대화 기록 페이지 추가
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
    // const [computerReply, setComputerReply] = useState<string>(""); // 컴퓨터 답장 상태
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
            if (message.delta) {
                // 메시지 데이터가 유효한 경우만 처리
                // setComputerReply(prev => prev + message.delta); // 컴퓨터 응답 업데이트

                // 오디오 데이터 재생
                try {
                    playAudio(message.delta); // delta가 오디오 데이터라고 가정
                } catch (error) {
                    console.error("Error playing audio delta:", error);
                }
            } else {
                console.error("Received empty or invalid delta:", message);
            }
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
        setAnimateGlow(!animateGlow); // 글로우 효과 토글

        if (!isRecording) {
            try {
                // setComputerReply(""); // 녹음을 시작할 때 컴퓨터의 답장을 초기화
                startSession();
                await startAudioRecording(); // 음성 녹음 시작
                resetAudioPlayer(); // 플레이어 초기화
                setIsRecording(true);
            } catch (error) {
                console.error("녹음 시작 중 오류:", error);
            }
        } else {
            try {
                await stopAudioRecording(); // 녹음 중지
                stopAudioPlayer(); // 플레이어 중지
                inputAudioBufferClear(); // 오디오 버퍼 초기화

                setIsRecording(false);
            } catch (error) {
                console.error("녹음 중지 중 오류:", error);
            }
        }
    };

    const { t } = useTranslation();

    return (
        <div className="app">
            {/* 메인 홈 페이지 */}
            <Button
                onClick={onToggleListening} // 기존 녹음 시작/중지 기능 유지
                className="microphone-button" // 필요한 최소한의 스타일 클래스
                aria-label={isRecording ? t("app.stopRecording") : t("app.startRecording")} // 접근성 레이블
            >
                <span className={`mic-icon ${isRecording ? "glow" : ""}`}>
                    <CiMicrophoneOn />
                </span>
            </Button>

            {/* <StatusMessage isRecording={isRecording} /> */}

            {/* 2x2 버튼 레이아웃 */}
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

            {/* 페이지 이동 */}
            <Routes>
                <Route
                    path="/"
                    element={
                        <>
                            {/* 헤더 */}
                            <h1 className="header">
                                <img src={LogoImage} alt="로고" />
                                살펴 - 드림
                            </h1>
                            {/* 자막 */}
                            {/* <div className="subtitle">{computerReply || "대화를 시작해주세요."}</div> */}

                            {/* 곡선 애니메이션 */}
                            <BottomCurve animateGlow={isRecording} />
                        </>
                    }
                />
                <Route path="/chat-history" element={<ChatHistory />} />
                <Route path="chat-history" element={<ChatHistory />} />
                <Route path="TodoPage" element={<TodoPage />} />
                <Route path="setting" element={<Setting />} />
            </Routes>

            {/* 파일 저장 */}
            <GroundingFiles files={groundingFiles} onSelected={setSelectedFile} />
            <GroundingFileView groundingFile={selectedFile} onClosed={() => setSelectedFile(null)} />
        </div>
    );
}
export default App;
