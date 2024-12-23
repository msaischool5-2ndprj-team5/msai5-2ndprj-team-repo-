import React from "react";
import "./BottomCurve.css"; // 애니메이션 CSS 파일

interface BottomCurveProps {
    animateGlow: boolean;
}

const BottomCurve: React.FC<BottomCurveProps> = ({ animateGlow }) => {
    return (
        <div className={`bottom-curve ${animateGlow ? "active-animation" : ""}`}>
            <svg viewBox="0 0 500 100" preserveAspectRatio="none" className="curve-svg">
                {/* 선 (라인) */}
                <path className="curve-path" d="M0,50 Q250,0 500,50" />

                {/* 글로우 (움직이는 빛) */}
                <path className={`curve-glow ${animateGlow ? "glow" : ""}`} d="M0,50 Q250,0 500,50" />
            </svg>
        </div>
    );
};

export default BottomCurve;
