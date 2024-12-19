import React, { CSSProperties } from "react";

const ChatHistory: React.FC = () => {
    return (
        <div style={styles.container}>
            <h1 style={styles.title}>대화 기록</h1>
            <p>여기에 대화 기록이 표시됩니다.</p>
        </div>
    );
};

// 스타일 타입 명시
const styles: {
    container: CSSProperties;
    title: CSSProperties;
} = {
    container: {
        textAlign: "center",
        padding: "50px",
        backgroundColor: "#f5f7fa",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif"
    },
    title: {
        fontSize: "2rem",
        fontWeight: "bold",
        color: "#002244"
    }
};

export default ChatHistory;
