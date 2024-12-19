import React from "react";
import "./BottomCurve.css"; // 애니메이션 CSS 파일

interface BottomCurveProps {
    animateGlow: boolean;
}

const BottomCurve: React.FC<BottomCurveProps> = ({ animateGlow }) => {
    return (
        <div className={`bottom-curve ${animateGlow ? "active-animation" : ""}`}>
            <svg className="curve-svg">
                {/* SVG Path */}
                <path className={`curve-path ${animateGlow ? "glow-animation" : ""}`} d="M0,0 C150,200 350,0 500,200 L500,500 L0,500 Z" />
            </svg>
        </div>
    );
};

export default BottomCurve;
