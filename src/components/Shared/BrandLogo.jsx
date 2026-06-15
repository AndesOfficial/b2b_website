export default function BrandLogo({ className = "w-8 h-8 text-[#1976D2]" }) {
    return (
        <div className={className}>
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                {/* Roof */}
                <path d="M 6 30 L 32 10 L 58 30" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                {/* Basket */}
                <path d="M 16 40 L 48 40 L 42 60 L 22 60 Z" fill="currentColor" />
                {/* Smile inside Basket */}
                <path d="M 23 45 Q 32 54 41 45" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
        </div>
    );
}
