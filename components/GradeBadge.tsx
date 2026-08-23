import type { Grade } from "@/lib/eeat/schema";

function gradeColor(grade: Grade): { bg: string; text: string; ring: string } {
  const letter = grade[0];
  switch (letter) {
    case "A":
      return { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" };
    case "B":
      return { bg: "bg-lime-50", text: "text-lime-700", ring: "ring-lime-200" };
    case "C":
      return { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" };
    case "D":
      return { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200" };
    default:
      return { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" };
  }
}

export function GradeBadge({
  grade,
  size = "md",
}: {
  grade: Grade;
  size?: "sm" | "md" | "lg";
}) {
  const { bg, text, ring } = gradeColor(grade);
  const sizeClasses = {
    sm: "h-10 w-10 text-base",
    md: "h-16 w-16 text-2xl",
    lg: "h-24 w-24 text-4xl",
  }[size];

  return (
    <div
      className={`flex ${sizeClasses} shrink-0 items-center justify-center rounded-full ${bg} ${text} font-bold ring-4 ${ring}`}
    >
      {grade}
    </div>
  );
}
