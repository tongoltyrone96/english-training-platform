import Image from "next/image";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return <main className="auth-page glass-login">
    <div className="glass-stage" aria-hidden="true">
      <Image className="glass-deco deco-ring" src="/auth/deco-ring.png" width={192} height={89} alt="" />
      <Image className="glass-deco deco-left-mark" src="/auth/deco-left-mark.png" width={111} height={61} alt="" />
      <Image className="glass-deco deco-zigzag" src="/auth/deco-zigzag.png" width={196} height={116} alt="" />
      <Image className="glass-deco deco-loop" src="/auth/deco-loop.png" width={476} height={443} alt="" />
      <Image className="glass-deco deco-large-wave" src="/auth/deco-large-wave.png" width={263} height={263} alt="" />
      <Image className="glass-deco deco-left-loop" src="/auth/deco-left-loop.png" width={293} height={286} alt="" />
      <Image className="glass-deco deco-wave-mid" src="/auth/deco-wave-mid.png" width={147} height={62} alt="" />
      <Image className="glass-deco deco-wave-right" src="/auth/deco-wave-right.png" width={126} height={41} alt="" />
      <Image className="glass-deco deco-cloud" src="/auth/deco-cloud.png" width={206} height={132} alt="" />
    </div>
    {children}
  </main>;
}
