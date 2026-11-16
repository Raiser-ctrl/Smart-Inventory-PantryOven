"use client";

type BreadyMascotProps = {
  talking?: boolean;
  className?: string;
};

export default function BreadyMascot({
  talking = false,
  className = "",
}: BreadyMascotProps) {
  return (
    <svg
      viewBox="0 0 120 110"
      className={`h-full w-full overflow-visible ${className}`}
      role="img"
      aria-label="Bready, karakter croissant kartun"
    >
      {/* Arms */}
      <path
        d="M25 69 Q12 62 11 49"
        fill="none"
        stroke="#A86B39"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M95 69 Q109 62 111 48"
        fill="none"
        stroke="#A86B39"
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* Croissant body */}
      <path
        d="M12 48 Q8 27 27 23 Q34 10 48 18 Q60 7 73 18 Q88 10 96 27 Q114 29 108 49 Q103 76 87 84 Q72 96 60 84 Q47 96 32 84 Q15 75 12 48 Z"
        fill="#D99448"
        stroke="#925625"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Pastry layers */}
      {[
        "M29 25 Q18 48 34 80",
        "M48 19 Q36 47 48 84",
        "M73 19 Q85 47 73 84",
        "M92 27 Q101 48 86 79",
      ].map((path, index) => (
        <path
          key={index}
          d={path}
          fill="none"
          stroke={
            index === 1 || index === 2
              ? "#F8D394"
              : "#F3BC70"
          }
          strokeWidth="13"
          strokeLinecap="round"
        />
      ))}

      {/* Highlights */}
      <path
        d="M26 38 Q30 28 35 26"
        fill="none"
        stroke="#FFF0C7"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Eyes */}
      <ellipse cx="48" cy="56" rx="3.5" ry="4.5" fill="#503526" />
      <ellipse cx="73" cy="56" rx="3.5" ry="4.5" fill="#503526" />

      {/* Cheeks */}
      <ellipse
        cx="39"
        cy="65"
        rx="7"
        ry="4"
        fill="#E9877B"
        opacity="0.7"
      />
      <ellipse
        cx="82"
        cy="65"
        rx="7"
        ry="4"
        fill="#E9877B"
        opacity="0.7"
      />

      {/* Mouth */}
      {talking ? (
        <ellipse cx="60" cy="68" rx="5" ry="6" fill="#503526" />
      ) : (
        <path
          d="M54 66 Q60 73 67 66"
          fill="none"
          stroke="#503526"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}

      {/* Feet */}
      <path
        d="M47 85 L44 94 M74 85 L77 94"
        fill="none"
        stroke="#925625"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}