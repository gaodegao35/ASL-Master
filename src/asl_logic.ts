/**
 * ASL Gesture Detection Logic
 * Based on MediaPipe Hand Landmarks
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type HandLandmarks = Landmark[];

export interface ASLLetter {
  letter: string;
  description: string;
  hint: string;
  diagramUrl: string;
}

export const ASL_LESSONS: ASLLetter[] = [
  {
    letter: "A",
    description: "Make a fist with your hand. Keep the thumb resting on the side of the fist.",
    hint: "All fingers folded. Thumb visible on the side.",
    diagramUrl: "/assets/asl/a.gif"
  },
  {
    letter: "B",
    description: "Open your palm with all fingers straight and together. Fold your thumb across your palm.",
    hint: "Fingers straight up. Thumb folded across the palm.",
    diagramUrl: "/assets/asl/b.gif"
  },
  {
    letter: "C",
    description: "Curve your hand into a 'C' shape, as if you are holding a large cup.",
    hint: "Hand curved like a claw. Fingers and thumb separated.",
    diagramUrl: "/assets/asl/asl_c.png"
  },
  {
    letter: "D",
    description: "Point your index finger straight up. Touch your thumb to your other three fingers to form a circle.",
    hint: "Index up, others form a circle with the thumb.",
    diagramUrl: "/assets/asl/d.gif"
  },
  {
    letter: "E",
    description: "Fold all your fingers and your thumb tightly against your palm.",
    hint: "All fingers curled, tips touching the thumb.",
    diagramUrl: "/assets/asl/e.gif"
  },
  {
    letter: "F",
    description: "Touch your index finger to your thumb. Keep your other three fingers straight and spread out.",
    hint: "Index and thumb touch. Other fingers up.",
    diagramUrl: "/assets/asl/f.gif"
  },
  {
    letter: "G",
    description: "Point your index finger and thumb sideways, close together as if measuring something small.",
    hint: "Index and thumb point sideways, almost touching.",
    diagramUrl: "/assets/asl/g.gif"
  },
  {
    letter: "H",
    description: "Point your index and middle fingers sideways and together. Fold the others.",
    hint: "Index and middle point sideways, together.",
    diagramUrl: "/assets/asl/h.gif"
  },
  {
    letter: "I",
    description: "Point your pinky finger straight up. Fold all other fingers into a fist.",
    hint: "Pinky up, others down.",
    diagramUrl: "/assets/asl/i.gif"
  },
  {
    letter: "J",
    description: "Start with the 'I' sign (pinky up) and draw a 'J' shape in the air.",
    hint: "Pinky up, draw a hook shape.",
    diagramUrl: "/assets/asl/j.gif"
  },
  {
    letter: "K",
    description: "Point your index and middle fingers up. Touch your thumb to the middle of your middle finger.",
    hint: "Index and middle up, thumb touches middle.",
    diagramUrl: "/assets/asl/k.gif"
  },
  {
    letter: "L",
    description: "Point your index finger straight up and extend your thumb out to the side to form an 'L'.",
    hint: "Index up, thumb out. Other fingers folded.",
    diagramUrl: "/assets/asl/l.gif"
  },
  {
    letter: "M",
    description: "Fold your thumb under your index, middle, and ring fingers.",
    hint: "Thumb under three fingers.",
    diagramUrl: "/assets/asl/m.gif"
  },
  {
    letter: "N",
    description: "Fold your thumb under your index and middle fingers.",
    hint: "Thumb under two fingers.",
    diagramUrl: "/assets/asl/n.gif"
  },
  {
    letter: "O",
    description: "Touch all your fingers to your thumb to form an 'O' shape.",
    hint: "All fingers touch thumb in a circle.",
    diagramUrl: "/assets/asl/o.gif"
  },
  {
    letter: "P",
    description: "Like the 'K' sign, but point your hand downwards.",
    hint: "Index and middle point down, thumb touches middle.",
    diagramUrl: "/assets/asl/p.gif"
  },
  {
    letter: "Q",
    description: "Like the 'G' sign, but point your index finger and thumb downwards.",
    hint: "Index and thumb point down, close together.",
    diagramUrl: "/assets/asl/q.gif"
  },
  {
    letter: "R",
    description: "Cross your index and middle fingers. Fold the others.",
    hint: "Index and middle fingers crossed.",
    diagramUrl: "/assets/asl/r.gif"
  },
  {
    letter: "S",
    description: "Make a fist and place your thumb across the front of your fingers.",
    hint: "Fist with thumb across the front.",
    diagramUrl: "/assets/asl/s.gif"
  },
  {
    letter: "T",
    description: "Make a fist and tuck your thumb under your index finger.",
    hint: "Thumb under index finger.",
    diagramUrl: "/assets/asl/t.gif"
  },
  {
    letter: "U",
    description: "Point your index and middle fingers straight up and keep them together.",
    hint: "Index and middle up, together.",
    diagramUrl: "/assets/asl/u.gif"
  },
  {
    letter: "V",
    description: "Extend your index and middle fingers in a 'V' shape. Fold the others.",
    hint: "Peace sign! Index and middle up, apart.",
    diagramUrl: "/assets/asl/v.gif"
  },
  {
    letter: "W",
    description: "Extend your index, middle, and ring fingers. Fold the pinky and thumb.",
    hint: "Three fingers up! Index, middle, and ring.",
    diagramUrl: "/assets/asl/w.gif"
  },
  {
    letter: "X",
    description: "Fold all fingers except the index. Hook your index finger slightly.",
    hint: "Index hooked, others down.",
    diagramUrl: "/assets/asl/x.gif"
  },
  {
    letter: "Y",
    description: "Extend your thumb and pinky finger. Fold the other fingers.",
    hint: "Thumb and pinky out, others down.",
    diagramUrl: "/assets/asl/y.gif"
  },
  {
    letter: "Z",
    description: "Point your index finger and draw a 'Z' shape in the air.",
    hint: "Index up, draw a Z shape.",
    diagramUrl: "/assets/asl/asl_z.png"
  }
];

export enum FingerState {
  EXTENDED = "EXTENDED",
  BENT = "BENT",
  FOLDED = "FOLDED",
  HOOKED = "HOOKED"
}

export interface HandFeatures {
  palmSize: number;
  isVertical: boolean;
  isHorizontal: boolean;
  fingerStates: FingerState[];
  fingerSpreads: number[];
  thumbOut: boolean;
  thumbPosition: number; // 0: side (A), 1: index (T), 2: middle (N), 3: ring (M), 4: pinky
  isCrossing: boolean;
  clustering: number;
  thumbContact: number[]; // indices of fingers thumb is touching
  tipDistances: number[]; // distances from fingertips to palm center
  opennessRatio: number; // distance between thumb tip and index tip
  arcConsistency: number; // variance in tip distances for fingers 1-4
  indexOrientation: { isVertical: boolean; isHorizontal: boolean };
  pointingDown: boolean; // index finger points downward (used for P and Q)
}

const getFingerState = (landmarks: HandLandmarks, tip: number, pip: number, mcp: number, wrist: number, palmSize: number): FingerState => {
  const dist = (p1: number, p2: number) => Math.sqrt(Math.pow(landmarks[p1].x - landmarks[p2].x, 2) + Math.pow(landmarks[p1].y - landmarks[p2].y, 2));
  
  const tipToWrist = dist(tip, wrist);
  const mcpToWrist = dist(mcp, wrist);
  const pipToWrist = dist(pip, wrist);
  
  if (tipToWrist > mcpToWrist * 1.25) return FingerState.EXTENDED;
  if (tipToWrist < mcpToWrist * 0.95 || dist(tip, mcp) < palmSize * 0.45) return FingerState.FOLDED;
  if (pipToWrist > tipToWrist * 1.05 && pipToWrist > mcpToWrist * 1.05) return FingerState.HOOKED;
  
  return FingerState.BENT;
};

const extractFeatures = (landmarks: HandLandmarks): HandFeatures => {
  const dist = (p1: number, p2: number) => Math.sqrt(Math.pow(landmarks[p1].x - landmarks[p2].x, 2) + Math.pow(landmarks[p1].y - landmarks[p2].y, 2));
  
  const wrist = 0;
  const thumbTip = 4, indexMcp = 5, middleMcp = 9, ringMcp = 13, pinkyMcp = 17;
  const indexTip = 8, middleTip = 12, ringTip = 16, pinkyTip = 20;
  
  const palmSize = dist(wrist, middleMcp);
  
  const fingerStates = [
    getFingerState(landmarks, 4, 3, 2, 0, palmSize), // thumb (approx)
    getFingerState(landmarks, 8, 7, 5, 0, palmSize), // index
    getFingerState(landmarks, 12, 11, 9, 0, palmSize), // middle
    getFingerState(landmarks, 16, 15, 13, 0, palmSize), // ring
    getFingerState(landmarks, 20, 19, 17, 0, palmSize) // pinky
  ];
  
  const fingerSpreads = [
    dist(indexTip, middleTip) / palmSize,
    dist(middleTip, ringTip) / palmSize,
    dist(ringTip, pinkyTip) / palmSize
  ];
  
  const thumbOut = dist(thumbTip, indexMcp) > palmSize * 0.5;
  
  // Rotation-invariant thumb position: project the thumb tip onto the knuckle
  // line running from the index MCP (rel 0) to the pinky MCP (rel 1). Using a
  // projection instead of a raw x-difference keeps this stable when the hand is
  // tilted or the camera feed is mirrored — the previous x-only comparison made
  // A/T/S/E (all closed fists) collapse into one another. A's thumb rests on the
  // radial side, so it projects at/below the index knuckle (≈0 or negative); a
  // thumb tucked between index & middle (T) lands a bit further along the line.
  const kvx = landmarks[pinkyMcp].x - landmarks[indexMcp].x;
  const kvy = landmarks[pinkyMcp].y - landmarks[indexMcp].y;
  const kLen2 = kvx * kvx + kvy * kvy || 1e-6;
  const thumbRelX =
    ((landmarks[thumbTip].x - landmarks[indexMcp].x) * kvx +
     (landmarks[thumbTip].y - landmarks[indexMcp].y) * kvy) / kLen2;
  let thumbPosition = 0;
  if (thumbRelX < 0.12) thumbPosition = 0;       // beside index → A
  else if (thumbRelX < 0.42) thumbPosition = 1;  // between index & middle → T / S / E
  else if (thumbRelX < 0.65) thumbPosition = 2;  // over middle → N
  else if (thumbRelX < 0.85) thumbPosition = 3;  // over ring → M
  else thumbPosition = 4;
  
  const isCrossing = (landmarks[indexTip].x - landmarks[middleTip].x) * (landmarks[indexMcp].x - landmarks[middleMcp].x) < 0;
  
  const tips = [indexTip, middleTip, ringTip, pinkyTip];
  let clustering = 0;
  tips.forEach(t1 => {
    tips.forEach(t2 => {
      if (t1 !== t2) clustering += dist(t1, t2);
    });
  });
  clustering = (clustering / 12) / palmSize;
  
  const thumbContact = [];
  for (let i = 1; i <= 4; i++) {
    const tipIdx = i * 4 + 4;
    if (dist(thumbTip, tipIdx) < palmSize * 0.35) thumbContact.push(i);
  }
  
  const isVertical = Math.abs(landmarks[middleTip].y - landmarks[wrist].y) > Math.abs(landmarks[middleTip].x - landmarks[wrist].x);
  const isHorizontal = !isVertical;

  const tipDistances = tips.map(t => dist(t, middleMcp) / palmSize);
  const opennessRatio = dist(thumbTip, indexTip) / palmSize;
  
  const avgDist = tipDistances.reduce((a, b) => a + b, 0) / 4;
  const arcConsistency = tipDistances.reduce((a, b) => a + Math.pow(b - avgDist, 2), 0) / 4;

  const indexVectorX = Math.abs(landmarks[8].x - landmarks[5].x);
  const indexVectorY = Math.abs(landmarks[8].y - landmarks[5].y);
  const indexOrientation = {
    isVertical: indexVectorY > indexVectorX,
    isHorizontal: indexVectorX > indexVectorY
  };

  // Directional check: index tip below its knuckle (image y grows downward),
  // with the downward component dominating any sideways lean. Distinguishes
  // P/Q (point down) from K/L (point up) and G/H (point sideways).
  const indexDy = landmarks[8].y - landmarks[5].y;
  const indexDx = landmarks[8].x - landmarks[5].x;
  const pointingDown = indexDy > Math.abs(indexDx) * 0.5;

  return {
    palmSize, isVertical, isHorizontal, fingerStates, fingerSpreads, thumbOut, thumbPosition, isCrossing, clustering, thumbContact, tipDistances, opennessRatio, arcConsistency, indexOrientation, pointingDown
  };
};

const scoreLetter = (letter: string, features: HandFeatures): number => {
  const { fingerStates, thumbOut, thumbPosition, isCrossing, fingerSpreads, clustering, thumbContact, tipDistances, opennessRatio, arcConsistency } = features;
  let score = 0;
  
  const isExtended = (i: number) => fingerStates[i] === FingerState.EXTENDED;
  const isFolded = (i: number) => fingerStates[i] === FingerState.FOLDED;
  const isHooked = (i: number) => fingerStates[i] === FingerState.HOOKED;
  const isBent = (i: number) => fingerStates[i] === FingerState.BENT;
  const isCurved = (i: number) => isBent(i) || isHooked(i);

  switch (letter) {
    case "A":
      if (isFolded(1) && isFolded(2) && isFolded(3) && isFolded(4)) score += 60;
      if (thumbPosition === 0) score += 40;
      break;
    case "B":
      if ((isExtended(1) || isBent(1)) && (isExtended(2) || isBent(2)) && (isExtended(3) || isBent(3)) && (isExtended(4) || isBent(4))) score += 60;
      if (!thumbOut) score += 20;
      if (clustering < 0.4) score += 20;
      break;
    case "C":
      // C uses the circular/stacked logic of O, but the thumb MUST NOT touch.
      // 1. Fingers should be stacked/grouped (low clustering) like in O.
      if (clustering < 0.35) score += 50;
      
      // 2. Restriction: Thumb MUST NOT be touching any other fingers.
      if (thumbContact.length === 0) score += 50;
      else score = 0; // Immediate fail if thumb touches (that would be O)

      // 3. Silhouette check: Ensure fingers are curved halfway, not straight (B) or closed (O).
      const avgTipDistC = tipDistances.reduce((a, b) => a + b, 0) / 4;
      if (avgTipDistC > 0.95 || opennessRatio < 0.45) score = 0;
      break;
    case "D":
      if (isExtended(1) && isFolded(2) && isFolded(3) && isFolded(4)) score += 60;
      if (thumbContact.includes(2) || thumbContact.includes(3)) score += 40;
      break;
    case "E":
      if (isFolded(1) && isFolded(2) && isFolded(3) && isFolded(4)) score += 50;
      if (!thumbOut && thumbPosition >= 1 && thumbPosition <= 3) score += 50;
      break;
    case "F":
      if (thumbContact.includes(1) && isExtended(2) && isExtended(3) && isExtended(4)) score += 80;
      break;
    case "G":
      // Index extended or bent, others folded
      if ((isExtended(1) || isBent(1)) && isFolded(2) && isFolded(3) && isFolded(4)) score += 50;
      
      // Orientation: index finger should be horizontal
      if (features.indexOrientation.isHorizontal) score += 30;
      else if (features.isHorizontal) score += 10;

      // Thumb position: for G, thumb is usually near index or out
      if (thumbOut || thumbPosition <= 1) score += 20;
      break;
    case "H":
      if (isExtended(1) && isExtended(2) && isFolded(3) && isFolded(4)) score += 60;
      if (features.isHorizontal) score += 40;
      break;
    case "I":
      if (isFolded(1) && isFolded(2) && isFolded(3) && isExtended(4)) score += 80;
      break;
    case "K":
      if (isExtended(1) && isExtended(2) && isFolded(3) && isFolded(4)) score += 60;
      if (thumbContact.includes(2)) score += 40;
      break;
    case "L":
      if (isExtended(1) && isFolded(2) && isFolded(3) && isFolded(4)) score += 50;
      if (thumbOut && features.isVertical) score += 50;
      break;
    case "M":
      if (isFolded(1) && isFolded(2) && isFolded(3) && isFolded(4)) score += 40;
      if (thumbPosition >= 3) score += 60;
      break;
    case "N":
      if (isFolded(1) && isFolded(2) && isFolded(3) && isFolded(4)) score += 40;
      if (thumbPosition === 2) score += 60;
      break;
    case "O":
      if (clustering < 0.3) score += 70;
      if (thumbContact.length >= 2) score += 30;
      break;
    case "P":
      // Like K but pointing down: index + middle extended, hand aimed downward.
      if (isExtended(1) && isExtended(2) && isFolded(3) && isFolded(4)) score += 40;
      if (features.pointingDown) score += 60;
      break;
    case "Q":
      // Like G but pointing down: index extended, thumb out, hand aimed downward.
      if (isExtended(1) && isFolded(2) && isFolded(3) && isFolded(4)) score += 40;
      if (thumbOut && features.pointingDown) score += 60;
      break;
    case "R":
      if (isExtended(1) && isExtended(2) && isFolded(3) && isFolded(4)) score += 50;
      if (isCrossing) score += 50;
      break;
    case "S":
      if (isFolded(1) && isFolded(2) && isFolded(3) && isFolded(4)) score += 60;
      if (thumbPosition >= 1 && thumbPosition <= 2) score += 40;
      break;
    case "T":
      if (isFolded(1) && isFolded(2) && isFolded(3) && isFolded(4)) score += 40;
      if (thumbPosition === 1) score += 60;
      break;
    case "U":
      if (isExtended(1) && isExtended(2) && isFolded(3) && isFolded(4)) score += 60;
      if (fingerSpreads[0] < 0.3) score += 40;
      break;
    case "V":
      if (isExtended(1) && isExtended(2) && isFolded(3) && isFolded(4)) score += 60;
      if (fingerSpreads[0] > 0.4) score += 40;
      break;
    case "W":
      if (isExtended(1) && isExtended(2) && isExtended(3) && isFolded(4)) score += 70;
      if (fingerSpreads[0] > 0.3 && fingerSpreads[1] > 0.3) score += 30;
      break;
    case "X":
      // X is a hooked index finger.
      const indexDist = tipDistances[0];
      if (indexDist > 0.4 && indexDist < 0.8) score += 50; // Hooked distance
      if (isFolded(2) && isFolded(3) && isFolded(4)) score += 30;
      if (thumbPosition <= 1) score += 20;
      break;
    case "Y":
      if (isFolded(1) && isFolded(2) && isFolded(3) && isExtended(4)) score += 50;
      if (thumbOut) score += 50;
      break;
  }
  return score;
};

export const getAdaptiveHint = (letter: string, landmarks: HandLandmarks, includeDiagramHint: boolean = true): string => {
  if (!landmarks || landmarks.length < 21) return "Position your hand in the camera view.";
  const features = extractFeatures(landmarks);
  const { fingerStates, thumbOut, thumbPosition, thumbContact, tipDistances, opennessRatio, arcConsistency, clustering } = features;
  
  const isExtended = (i: number) => fingerStates[i] === FingerState.EXTENDED;
  const isFolded = (i: number) => fingerStates[i] === FingerState.FOLDED;
  const isBent = (i: number) => fingerStates[i] === FingerState.BENT;
  const isHooked = (i: number) => fingerStates[i] === FingerState.HOOKED;
  const isCurved = (i: number) => isBent(i) || isHooked(i);

  switch (letter) {
    case "A":
      if (!isFolded(1) || !isFolded(2) || !isFolded(3) || !isFolded(4)) return "Fold all your fingers into a tight fist.";
      if (thumbPosition > 0) return "Move your thumb to the side of your fist.";
      break;
    case "B":
      if (!isExtended(1) || !isExtended(2) || !isExtended(3) || !isExtended(4)) return "Straighten all four fingers and point them up.";
      if (thumbOut) return "Fold your thumb across your palm.";
      break;
    case "C":
      const avgTipDistHint = tipDistances.reduce((a, b) => a + b, 0) / 4;
      if (thumbContact.length > 0) return "Open your hand slightly; your thumb should not touch your fingers (avoid 'O').";
      if (clustering > 0.35) return "Turn your hand to the side so your fingers are stacked" + (includeDiagramHint ? ", matching the diagram." : ".");
      if (avgTipDistHint > 0.9) return "Curve your fingers more toward your palm to form a 'C' silhouette.";
      if (opennessRatio < 0.45) return "Ensure there's a clear open gap between your thumb and fingers.";
      break;
    case "D":
      if (!isExtended(1)) return "Point your index finger straight up.";
      if (isExtended(2) || isExtended(3) || isExtended(4)) return "Fold your middle, ring, and pinky fingers down.";
      if (!thumbContact.includes(2)) return "Touch your thumb to your middle finger.";
      break;
    case "E":
      if (!isFolded(1) || !isFolded(2) || !isFolded(3) || !isFolded(4)) return "Fold all your fingers tightly.";
      if (thumbOut) return "Tuck your thumb under your fingers.";
      break;
    case "F":
      if (!thumbContact.includes(1)) return "Touch your index finger to your thumb.";
      if (!isExtended(2) || !isExtended(3) || !isExtended(4)) return "Straighten your middle, ring, and pinky fingers.";
      break;
    case "G":
      if (!isExtended(1)) return "Point your index finger sideways.";
      if (!thumbOut) return "Extend your thumb parallel to your index finger.";
      break;
    case "H":
      if (!isExtended(1) || !isExtended(2)) return "Point both index and middle fingers sideways.";
      break;
    case "I":
      if (!isExtended(4)) return "Point your pinky finger straight up.";
      if (isExtended(1) || isExtended(2) || isExtended(3)) return "Fold your other fingers into a fist.";
      break;
    case "K":
      if (!isExtended(1) || !isExtended(2)) return "Point index and middle fingers up.";
      if (!thumbContact.includes(2)) return "Touch your thumb to the middle of your middle finger.";
      break;
    case "L":
      if (!isExtended(1)) return "Point your index finger up.";
      if (!thumbOut) return "Extend your thumb out to the side.";
      break;
    case "M":
      if (thumbPosition < 3) return "Tuck your thumb under your index, middle, and ring fingers.";
      break;
    case "N":
      if (thumbPosition !== 2) return "Tuck your thumb under your index and middle fingers.";
      break;
    case "O":
      return "Touch all your fingertips to your thumb to form a circle.";
    case "R":
      if (!features.isCrossing) return "Cross your index and middle fingers.";
      break;
    case "S":
      if (thumbPosition < 1 || thumbPosition > 2) return "Place your thumb across the front of your fist.";
      break;
    case "T":
      if (thumbPosition !== 1) return "Tuck your thumb under your index finger.";
      break;
    case "U":
      if (!isExtended(1) || !isExtended(2)) return "Point index and middle fingers up.";
      if (features.fingerSpreads[0] > 0.3) return "Keep your index and middle fingers together.";
      break;
    case "V":
      if (!isExtended(1) || !isExtended(2)) return "Point index and middle fingers up.";
      if (features.fingerSpreads[0] < 0.4) return "Spread your index and middle fingers apart.";
      break;
    case "W":
      if (!isExtended(1) || !isExtended(2) || !isExtended(3)) return "Point index, middle, and ring fingers up.";
      break;
    case "X":
      if (tipDistances[0] < 0.4) return "Extend your index finger slightly more into a hook.";
      if (tipDistances[0] > 0.8) return "Hook your index finger more toward your palm.";
      if (!isFolded(2) || !isFolded(3) || !isFolded(4)) return "Fold your other fingers tightly into a fist.";
      break;
    case "Y":
      if (!thumbOut || !isExtended(4)) return "Extend both your thumb and pinky finger.";
      break;
  }
  
  // Fallback to the general description if no specific mismatch is found
  const lesson = ASL_LESSONS.find(l => l.letter === letter);
  return lesson ? lesson.description : ("Adjust your hand to " + (includeDiagramHint ? "match the diagram." : "correctly sign the letter."));
};

export enum JState { IDLE = "IDLE", STABILIZING = "STABILIZING", TRACKING = "TRACKING", SUCCESS = "SUCCESS" }
export class JDetector {
  private state: JState = JState.IDLE;
  private stableFrames: number = 0;
  private minStableFrames: number = 8;
  private history: {x: number, y: number}[] = [];
  private startLandmarks: HandLandmarks | null = null;
  private downwardDetected: boolean = false;
  private bottomPos: {x: number, y: number} | null = null;
  private lastStateChange: number = 0;
  private handshapeLostFrames: number = 0;
  private maxLostFrames: number = 10;

  reset() { this.state = JState.IDLE; this.stableFrames = 0; this.history = []; this.startLandmarks = null; this.downwardDetected = false; this.bottomPos = null; this.handshapeLostFrames = 0; this.lastStateChange = Date.now(); }
  getHistory() { return this.history; }
  update(landmarks: HandLandmarks, palmSize: number, isIHandshape: boolean): boolean {
    const now = Date.now();
    const pinkyTip = 20;
    const pos = { x: landmarks[pinkyTip].x, y: landmarks[pinkyTip].y };
    switch (this.state) {
      case JState.IDLE: if (isIHandshape) { this.state = JState.STABILIZING; this.stableFrames = 1; this.lastStateChange = now; } break;
      case JState.STABILIZING: if (isIHandshape) { this.stableFrames++; if (this.stableFrames >= this.minStableFrames) { this.state = JState.TRACKING; this.startLandmarks = JSON.parse(JSON.stringify(landmarks)); this.history = [pos]; this.downwardDetected = false; this.lastStateChange = now; } } else this.reset(); break;
      case JState.TRACKING:
        this.history.push(pos);
        if (this.history.length > 30) this.history.shift();
        if (this.startLandmarks) {
          const dy = (landmarks[pinkyTip].y - this.startLandmarks[pinkyTip].y) / palmSize;
          // Track the lowest point of the downward swoop.
          if (this.bottomPos === null || pos.y > this.bottomPos.y) this.bottomPos = { x: pos.x, y: pos.y };
          // Require a clear, pronounced downward swoop first.
          if (dy > 0.3) this.downwardDetected = true;
          // The hook is the sideways curve measured FROM the bottom of the swoop.
          // A straight diagonal keeps moving the bottom with it, so it never accrues
          // sideways distance — only a real down-then-curve motion triggers. Either
          // horizontal direction is accepted (mirroring + handedness).
          if (this.downwardDetected && this.bottomPos) {
            const hookDx = (pos.x - this.bottomPos.x) / palmSize;
            if (Math.abs(hookDx) > 0.22) return true;
          }
        }
        if (!isIHandshape) { this.handshapeLostFrames++; if (this.handshapeLostFrames > this.maxLostFrames) this.reset(); } else this.handshapeLostFrames = 0;
        if (now - this.lastStateChange > 2000) this.reset();
        break;
    }
    return false;
  }
}

export enum ZState { IDLE = "IDLE", STABILIZING = "STABILIZING", TRACKING = "TRACKING", SUCCESS = "SUCCESS" }
export class ZDetector {
  private state: ZState = ZState.IDLE;
  private stableFrames: number = 0;
  private minStableFrames: number = 4;
  private history: {x: number, y: number}[] = [];
  private lastStateChange: number = 0;

  reset() { this.state = ZState.IDLE; this.stableFrames = 0; this.history = []; this.lastStateChange = Date.now(); }
  getHistory() { return this.history; }

  update(landmarks: HandLandmarks, palmSize: number, isIndexUp: boolean): boolean {
    const now = Date.now();
    const pos = { x: landmarks[8].x, y: landmarks[8].y };
    switch (this.state) {
      case ZState.IDLE:
        if (isIndexUp) { this.state = ZState.STABILIZING; this.stableFrames = 1; this.lastStateChange = now; }
        break;
      case ZState.STABILIZING:
        // Briefly confirm the index-up shape, then start tracking. Tolerate a
        // flickered frame (motion blur) instead of hard-resetting — only give up
        // if it never stabilizes within a short window.
        if (isIndexUp) this.stableFrames++;
        if (this.stableFrames >= this.minStableFrames) {
          this.state = ZState.TRACKING;
          this.history = [pos];
          this.lastStateChange = now;
        } else if (now - this.lastStateChange > 700) {
          this.reset();
        }
        break;
      case ZState.TRACKING:
        this.history.push(pos);
        if (this.history.length > 45) this.history.shift();
        if (this.detectZigzag(palmSize)) return true;
        if (now - this.lastStateChange > 4000) this.reset();
        break;
    }
    return false;
  }

  // A Z is a horizontal zigzag with net downward travel: three alternating
  // horizontal sweeps (i.e. two direction reversals). Counting reversals over
  // the trajectory is direction-agnostic (works regardless of mirroring or
  // handedness) and forgiving of timing and stroke drift, unlike a rigid
  // per-segment matcher.
  private detectZigzag(palmSize: number): boolean {
    const pts = this.history;
    if (pts.length < 8) return false;
    const minSeg = palmSize * 0.2; // ignore jitter below this horizontal travel
    let dir = 0, sweeps = 0, reversals = 0;
    let segStartX = pts[0].x;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - segStartX;
      if (Math.abs(dx) >= minSeg) {
        const d = dx > 0 ? 1 : -1;
        if (dir === 0) { dir = d; sweeps = 1; }
        else if (d !== dir) { reversals++; sweeps++; dir = d; }
        segStartX = pts[i].x;
      }
    }
    const netDown = (pts[pts.length - 1].y - pts[0].y) / palmSize > 0.1;
    return sweeps >= 3 && reversals >= 2 && netDown;
  }
}

export class DoubleLetterDetector {
  private startX: number | null = null;
  private startY: number | null = null;
  private isMoving: boolean = false;
  private framesInPose: number = 0;

  reset() { this.startX = null; this.startY = null; this.isMoving = false; this.framesInPose = 0; }
  detect(targetLetter: string, landmarks: HandLandmarks, palmSize: number): boolean {
    const baseLetter = targetLetter.length > 1 ? targetLetter[0] : targetLetter;
    if (!detectGesture(baseLetter, landmarks)) { this.reset(); return false; }
    this.framesInPose++;
    const currentX = landmarks[0].x;
    const currentY = landmarks[0].y;
    if (this.startX === null || this.startY === null) { this.startX = currentX; this.startY = currentY; return false; }
    const diffX = Math.abs(currentX - this.startX);
    const diffY = Math.abs(currentY - this.startY);
    if (diffX > palmSize * 0.12 && diffX > diffY * 1.5) this.isMoving = true;
    return this.isMoving && this.framesInPose > 10;
  }
}

export const detectGesture = (letter: string, landmarks: HandLandmarks, history: HandLandmarks[] = [], jDetector?: JDetector, zDetector?: ZDetector): boolean => {
  if (!landmarks || landmarks.length < 21) return false;
  if (letter === "J" && jDetector) {
    const features = extractFeatures(landmarks);
    const isIHandshape = features.fingerStates[4] === FingerState.EXTENDED && features.fingerStates[1] === FingerState.FOLDED && features.fingerStates[2] === FingerState.FOLDED && features.fingerStates[3] === FingerState.FOLDED;
    return jDetector.update(landmarks, features.palmSize, isIHandshape);
  }
  if (letter === "Z" && zDetector) {
    const features = extractFeatures(landmarks);
    const isIndexUp = features.fingerStates[1] === FingerState.EXTENDED && features.fingerStates[2] === FingerState.FOLDED && features.fingerStates[3] === FingerState.FOLDED && features.fingerStates[4] === FingerState.FOLDED;
    return zDetector.update(landmarks, features.palmSize, isIndexUp);
  }
  const features = extractFeatures(landmarks);
  return scoreLetter(letter, features) > 75;
};

export const classifyGesture = (landmarks: HandLandmarks, history: HandLandmarks[] = [], jDetector?: JDetector, zDetector?: ZDetector): { letter: string | null, confidence: number } => {
  if (!landmarks || landmarks.length < 21) return { letter: null, confidence: 0 };
  const features = extractFeatures(landmarks);
  const letters = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");
  let bestLetter = null;
  let maxScore = 0;
  letters.forEach(l => {
    const score = scoreLetter(l, features);
    if (score > maxScore) { maxScore = score; bestLetter = l; }
  });
  if (maxScore < 80) {
    if (jDetector && detectGesture("J", landmarks, history, jDetector)) return { letter: "J", confidence: 100 };
    if (zDetector && detectGesture("Z", landmarks, history, undefined, zDetector)) return { letter: "Z", confidence: 100 };
  }
  return maxScore > 70 ? { letter: bestLetter, confidence: maxScore } : { letter: null, confidence: 0 };
};
