import useWebSocket from "react-use-websocket";

import {
    InputAudioBufferAppendCommand,
    InputAudioBufferClearCommand,
    Message,
    ResponseAudioDelta,
    ResponseAudioTranscriptDelta,
    ResponseDone,
    SessionUpdateCommand,
    ExtensionMiddleTierToolResponse,
    ResponseInputAudioTranscriptionCompleted
} from "@/types";

type Parameters = {
    useDirectAoaiApi?: boolean; // 중간 계층 건너뛰기 여부
    aoaiEndpointOverride?: string; // AOAI API 엔드포인트
    aoaiApiKeyOverride?: string; // AOAI API 키
    aoaiModelOverride?: string; // AOAI 모델 이름

    enableInputAudioTranscription?: boolean; // 입력 오디오 전사 활성화 여부
    onWebSocketOpen?: () => void; // WebSocket 연결 성공 핸들러
    onWebSocketClose?: () => void; // WebSocket 연결 종료 핸들러
    onWebSocketError?: (event: Event) => void; // WebSocket 에러 핸들러
    onWebSocketMessage?: (event: MessageEvent<any>) => void; // WebSocket 메시지 핸들러

    onReceivedResponseAudioDelta?: (message: ResponseAudioDelta) => void; // 오디오 응답 처리
    onReceivedInputAudioBufferSpeechStarted?: (message: Message) => void; // 음성 감지 이벤트
    onReceivedResponseDone?: (message: ResponseDone) => void; // 응답 완료 이벤트
    onReceivedExtensionMiddleTierToolResponse?: (message: ExtensionMiddleTierToolResponse) => void; // 중간 계층 응답
    onReceivedResponseAudioTranscriptDelta?: (message: ResponseAudioTranscriptDelta) => void; // 텍스트 응답
    onReceivedInputAudioTranscriptionCompleted?: (message: ResponseInputAudioTranscriptionCompleted) => void; // 전사 완료
    onReceivedError?: (message: Message) => void; // 일반 에러 처리
};

export default function useRealTime({
    useDirectAoaiApi,
    aoaiEndpointOverride,
    aoaiApiKeyOverride,
    aoaiModelOverride,
    enableInputAudioTranscription,
    onWebSocketOpen,
    onWebSocketClose,
    onWebSocketError, // WebSocket 에러 핸들러 추가
    onWebSocketMessage,
    onReceivedResponseDone,
    onReceivedResponseAudioDelta,
    onReceivedResponseAudioTranscriptDelta,
    onReceivedInputAudioBufferSpeechStarted,
    onReceivedExtensionMiddleTierToolResponse,
    onReceivedInputAudioTranscriptionCompleted,
    onReceivedError
}: Parameters) {
    const wsEndpoint = useDirectAoaiApi
        ? `${aoaiEndpointOverride}/openai/realtime?api-key=${aoaiApiKeyOverride}&deployment=${aoaiModelOverride}&api-version=2024-10-01-preview&lanuage=ko-KR` // 한국언어 설정 추가
        : `/realtime`;

    // WebSocket 초기화
    const { sendJsonMessage } = useWebSocket(wsEndpoint, {
        onOpen: () => onWebSocketOpen?.(), // 연결 성공 시 호출
        onClose: () => onWebSocketClose?.(), // 연결 종료 시 호출
        onError: event => {
            console.error("WebSocket Error Event:", event); // WebSocket 에러 로그
            onWebSocketError?.(event); // 사용자 정의 에러 핸들러 호출
        },
        onMessage: event => onMessageReceived(event), // 메시지 수신 시 처리
        shouldReconnect: () => true // 자동 재연결 활성화
    });

    // 세션 시작
    const startSession = () => {
        const command: SessionUpdateCommand = {
            type: "session.update",
            session: {
                turn_detection: {
                    type: "server_vad" // 서버 측 음성 감지 활성화
                }
            }
        };

        if (enableInputAudioTranscription) {
            command.session.input_audio_transcription = {
                model: "whisper-1",
                language: "ko-KR" // 한국어 언어 설정 추가
            };
        }
        // 디버깅 로그: 전송하려는 메시지 확인
        console.log("WebSocket 메시지 전송:", command);

        sendJsonMessage(command); // WebSocket 메시지 전송
    };

    // 사용자 오디오 추가
    const addUserAudio = (base64Audio: string) => {
        const command: InputAudioBufferAppendCommand = {
            type: "input_audio_buffer.append",
            audio: base64Audio
        };

        sendJsonMessage(command);
    };

    // 입력 오디오 버퍼 초기화
    const inputAudioBufferClear = () => {
        const command: InputAudioBufferClearCommand = {
            type: "input_audio_buffer.clear"
        };

        sendJsonMessage(command);
    };

    // WebSocket 메시지 수신 핸들러
    const onMessageReceived = (event: MessageEvent<any>) => {
        onWebSocketMessage?.(event);

        let message: Message;
        try {
            message = JSON.parse(event.data);
        } catch (e) {
            console.error("Failed to parse JSON message:", e);
            throw e;
        }

        switch (message.type) {
            case "response.audio_transcript.done":
                console.log("response.audio_transcript.done:", message); // transcript 추출
                break;
            case "response.done":
                onReceivedResponseDone?.(message as ResponseDone);
                break;
            case "response.audio.delta":
                // console.log("Audio Delta:", message); // 오디오 응답 확인
                onReceivedResponseAudioDelta?.(message as ResponseAudioDelta);
                break;
            case "response.audio_transcript.delta":
                // console.log("Transcript Delta:", message); // 한국어 응답 확인
                onReceivedResponseAudioTranscriptDelta?.(message as ResponseAudioTranscriptDelta);
                break;
            case "input_audio_buffer.speech_started":
                onReceivedInputAudioBufferSpeechStarted?.(message);
                break;
            case "conversation.item.input_audio_transcription.completed":
                onReceivedInputAudioTranscriptionCompleted?.(message as ResponseInputAudioTranscriptionCompleted);
                break;
            case "extension.middle_tier_tool_response":
                onReceivedExtensionMiddleTierToolResponse?.(message as ExtensionMiddleTierToolResponse);
                break;
            case "error":
                console.error("WebSocket Error Message:", message); // 에러 메시지 확인
                onReceivedError?.(message);
                break;
        }
    };

    return { startSession, addUserAudio, inputAudioBufferClear };
}
