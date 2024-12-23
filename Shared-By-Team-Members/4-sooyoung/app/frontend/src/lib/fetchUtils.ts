// import react { useParams } from "react-router-dom";

// import { Hand } from "lucide-react";

// import { error } from "console";

// Fetch 유틸리티 함수들
const API_KEYS = {
    MASTER_KEY: import.meta.env.VITE_AZURE_FA_MASTER_API_KEY || "",
    CREATE_IMAGE_URL: import.meta.env.VITE_AZURE_FA_CREATE_IMAGE_URL || "",
    GET_HIST_URL: import.meta.env.VITE_AZURE_FA_GET_HIST_URL || "",
    HANDLE_SCHEDULE_WITH_GPT_URL: import.meta.env.VITE_AZURE_FA_HANDLE_SCHEDULE_WITH_GPT_URL || "",
    INIT_URL: import.meta.env.VITE_AZURE_FA_INIT_URL || "",
    SET_HIST_URL: import.meta.env.VITE_AZURE_FA_SET_HIST_URL || "",
    SET_MESSAGE_URL: import.meta.env.VITE_AZURE_FA_SET_MESSAGE_URL || "",
    SET_SCHEDULE_URL: import.meta.env.VITE_AZURE_FA_SET_SCHEDULE_URL || ""
};

// 환경 변수 확인
Object.entries(API_KEYS).forEach(([key, value]) => {
    if (!value) {
        console.error(`환경 변수 ${key}가 설정되지 않았습니다.`);
    }
});

// 에러 처리 함수
const handleError = (error: any) => {
    console.error("API 호출 에러:", error);
    throw error;
};

// 기본 Fetch 함수
export const fetchFromFunctionApp = async (url: string, method: "GET" | "POST", body?: object) => {
    try {
        const headers = {
            "Content-Type": "application/json"
        };

        const params = {
            code: API_KEYS.MASTER_KEY
        };

        const queryString = new URLSearchParams(params).toString();
        url = `${url}?${queryString}`;
        console.log("API 호출 URL:", url); // 디버깅용 로그

        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        const errorMessage = await response.text(); // 응답 먼저 테스트
        console.log("API 응답:", errorMessage);

        if (!response.ok) {
            throw new Error(`API 호출 실패: ${response.status} - ${errorMessage}`);
        }
        // JSON 파싱 시도
        try {
            return JSON.parse(errorMessage);
        } catch (parseError) {
            throw new Error(`JSON 파싱 실패: ${errorMessage}`);
        }
        // return response.json();
    } catch (error) {
        console.error("API 호출 중 에러 발생:", error);
        handleError(error); // handleError 함수 활용
    }
};

// 공통 호출 함수
const callAPI = async (key: keyof typeof API_KEYS, method: "GET" | "POST", body?: object) => {
    const url = API_KEYS[key];
    if (!url) {
        throw new Error(`${key} URL이 설정되지 않았습니다.`);
    }
    return fetchFromFunctionApp(url, method, body);
};

// 특정 API를 위한 함수들
// 1. 대화 히스토리 저장
export const saveChatHistory = async (userMessage: string, botMessage: string) => {
    return callAPI("SET_HIST_URL", "POST", { userMessage, botMessage });
};

// 2. 대화 히스토리 가져오기
export const getChatHistory = async () => {
    return callAPI("GET_HIST_URL", "GET");
};

// 3. 스케줄 관리
export const handleScheduleWithGPT = async (todoList: string[]) => {
    return callAPI("HANDLE_SCHEDULE_WITH_GPT_URL", "POST", { todos: todoList });
};
