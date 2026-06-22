"use client";

import { GuideStep as GuideStepType } from "@/app/hooks/Useguide";

interface GuideStepProps {
  step: GuideStepType;
}

export default function GuideStep({ step }: GuideStepProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xl">{step.icon}</span>
        <h3 className="font-bold text-gray-900 text-base">{step.title}</h3>
      </div>
      <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
    </div>
  );
}