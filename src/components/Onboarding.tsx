import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Hand, Lightbulb, CheckCircle2, X } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    title: "Position Your Hand",
    description: "Keep your hand clearly within the camera frame. Make sure your hand is fully visible and well-lit.",
    icon: <Camera className="w-12 h-12 text-blue-500" />,
    instruction: "Position your hand clearly within the camera frame."
  },
  {
    title: "Hold Steady",
    description: "Hold your gesture steady for a moment until it is detected. Wait for confirmation before moving to the next gesture.",
    icon: <Hand className="w-12 h-12 text-blue-500" />,
    instruction: "Hold your gesture steady for a moment until it is detected."
  }
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative"
        >
          <button 
            onClick={onComplete}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          <div className="p-8">
            <div className="flex justify-center mb-6">
              <motion.div
                key={currentStep}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-4 bg-blue-50 rounded-2xl"
              >
                {steps[currentStep].icon}
              </motion.div>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {steps[currentStep].title}
              </h2>
              <p className="text-gray-600 leading-relaxed">
                {steps[currentStep].description}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleNext}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-blue-200 active:scale-[0.98]"
              >
                {currentStep === steps.length - 1 ? "Got it!" : "Next Step"}
              </button>
              
              {currentStep === 0 && (
                <button
                  onClick={onComplete}
                  className="w-full py-3 text-gray-400 hover:text-gray-600 font-medium transition-colors"
                >
                  Skip onboarding
                </button>
              )}
            </div>

            <div className="flex justify-center gap-2 mt-8">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentStep ? "w-8 bg-blue-600" : "w-2 bg-gray-200"
                  }`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
