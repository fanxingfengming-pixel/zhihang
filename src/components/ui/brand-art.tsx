export function BrandArt() {
  return (
    <div className="brand-art" aria-hidden="true">
      <svg viewBox="0 0 720 520" role="img">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#abc5dc" />
            <stop offset="0.58" stopColor="#dce9f2" />
            <stop offset="1" stopColor="#f6f8f8" />
          </linearGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="15" />
          </filter>
        </defs>
        <rect width="720" height="520" rx="34" fill="url(#sky)" />
        <circle cx="548" cy="104" r="48" fill="#f4f0dc" opacity=".78" />
        <g fill="#fff" opacity=".48" filter="url(#soft)">
          <ellipse cx="158" cy="130" rx="116" ry="28" />
          <ellipse cx="245" cy="173" rx="142" ry="34" />
          <ellipse cx="588" cy="205" rx="130" ry="27" />
        </g>
        <path d="M0 390C112 346 210 351 292 385c94 39 168 36 242 7 58-23 118-19 186 13v115H0Z" fill="#b8cbd7" opacity=".78" />
        <path d="M0 437c130-28 240-22 332 18 76 33 183 29 388-15v80H0Z" fill="#d9e3e8" />
        <g opacity=".84">
          <path d="M74 313h176v165H74z" fill="#edf1f2" />
          <path d="M104 276h118l28 37H74z" fill="#7f98aa" />
          <path d="M102 342h24v98h-24zm47 0h24v98h-24zm47 0h24v98h-24z" fill="#a8bdc9" />
          <path d="M292 354h138v126H292z" fill="#d9e3e8" />
          <path d="M320 319h82l28 35H292z" fill="#829aaa" />
          <path d="M321 380h18v65h-18zm32 0h18v65h-18zm32 0h18v65h-18z" fill="#a8bbc6" />
          <path d="M484 292h160v190H484z" fill="#e9edef" />
          <path d="M510 248h107l27 44H484z" fill="#758fa2" />
          <path d="M516 324h20v116h-20zm38 0h20v116h-20zm38 0h20v116h-20z" fill="#a4bac7" />
        </g>
        <path d="M0 476h720v44H0z" fill="#f6f7f7" opacity=".82" />
      </svg>
      <div className="brand-art-copy">
        <span>ON THE WAY</span>
        <strong>山不让路，<br />人自有路。</strong>
      </div>
    </div>
  );
}
