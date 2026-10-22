// GLSL for Sherwood, ported from robinhood-agent web/js/modules/blobkit.js (T696).
// Changes for the site: the dashboard's photo studio (PMREM env + three directional lights + shadow)
// is replaced by STUDIO, the same studio evaluated analytically inside Sherwood's own materials, in
// Sherwood's own frame. Nothing is added to the host scene, so its other objects are unaffected,
// and the lighting turns with the blob as it faces the camera. The body's AO is measured in object
// space (the blob floats), and an appear flash term is added.

export const NOISE = /* glsl */ `
vec3 smMod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 smMod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 smPermute(vec4 x){return smMod289(((x*34.0)+10.0)*x);}
vec4 smTaylor(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float smNoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=smMod289(i);
  vec4 p=smPermute(smPermute(smPermute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=smTaylor(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// The body is a unit icosphere; smShape maps a direction to a point on the current silhouette.
export const SHAPE = /* glsl */ `
uniform float uTime, uEgg, uHex, uTri, uHeart, uFlower, uDrop, uMelt, uFlat, uBurst, uComet, uTwist, uTall, uWobble, uWobbleF, uLobe;
uniform float uBox, uBoxN, uBoxA;
uniform vec3 uSpk[14];
varying vec3 vSmDir;
varying float vSmWY;
${NOISE}
float smSmax(float a, float b, float k) { return 0.5 * (a + b + sqrt((a - b) * (a - b) + k)); }
vec3 smShape(vec3 p, out vec3 dir) {
  vec3 q = p;
  float a = uTwist * q.y * 2.2; float ca = cos(a), sa = sin(a);
  q.xz = mat2(ca, -sa, sa, ca) * q.xz;
  dir = q;
  vec3 P = q;
  float up = max(q.y, 0.0), dn = max(-q.y, 0.0);
  float th = atan(P.y, P.x);
  float wxy = smoothstep(0.0, 0.6, length(P.xy));
  float m6 = mod(th + 0.5236, 1.0472) - 0.5236;
  float h6 = mix(0.866 / cos(m6), 0.93, 0.3) * 1.07;
  float m3 = mod(th + 2.618, 2.0944) - 1.0472;
  float h3 = mix(0.5 / cos(m3), 1.0, 0.16) * 1.34;
  float hf = 1.0 + 0.2 * cos(5.0 * (th - uLobe));
  float bth = th - uBoxA;
  float hb = pow(pow(abs(cos(bth)), uBoxN) + pow(abs(sin(bth)), uBoxN), -1.0 / uBoxN) * 0.94;
  float rxy = 1.0 + (h6 - 1.0) * uHex + (h3 - 1.0) * uTri + (hf - 1.0) * uFlower + (hb - 1.0) * uBox;
  P.xy *= mix(1.0, rxy, wxy);
  P.z *= 1.0 - 0.22 * uHex - 0.32 * uTri - 0.12 * uFlower - 0.12 * uBox;
  P.y -= 0.25 * uTri;
  float hy = P.y;
  P.x *= 1.0 + uHeart * (0.16 * smoothstep(-0.2, 0.6, hy) - 0.8 * smoothstep(0.0, 1.0, -hy));
  P.y *= 1.0 + uHeart * 0.2 * (1.0 - smoothstep(-0.3, 0.1, hy));
  P.y -= uHeart * 0.3 * exp(-P.x * P.x / 0.06) * smoothstep(0.15, 0.95, hy);
  P.z *= 1.0 - 0.18 * uHeart;
  P.y += 0.16 * uHeart;
  P.y *= 1.0 + 0.17 * uEgg;
  P.xz *= 1.0 - uEgg * (0.14 * q.y + 0.03);
  P.xz *= 1.0 - uDrop * 0.78 * pow(up, 1.7);
  P.y *= 1.0 + uDrop * 0.36 * smoothstep(0.0, 1.0, q.y);
  P.xz *= 1.0 + uMelt * (0.27 * dn - 0.1 * up);
  float cut = -1.1 + 0.65 * uFlat;
  P.xz *= 1.0 + 0.22 * uFlat * dn;
  P.y = smSmax(P.y, cut, 0.006) - max(cut + 1.0, 0.0);
  P.y *= 1.0 + 0.5 * uTall;
  P.xz *= 1.0 - uTall * (0.4 - 0.2 * q.y);
  float sp = 0.0;
  for (int i = 0; i < 14; i++) { float d = max(dot(q, uSpk[i]), 0.0); sp += pow(d, 34.0); }
  P += q * sp * uBurst * 0.62 * (1.0 - 0.9 * smoothstep(0.55, 0.9, q.z));
  float cs = sign(uComet), cm = abs(uComet);
  float back = max(-cs * q.x, 0.0);
  P.x -= cs * cm * pow(back, 2.2) * 1.45;
  P.yz *= 1.0 - cm * 0.72 * smoothstep(0.0, 1.0, back);
  float face = smoothstep(0.5, 0.95, q.z);
  float n = smNoise(q * uWobbleF + vec3(0.0, uTime * 0.45, uTime * 0.21));
  P += q * n * uWobble * (1.0 - 0.75 * face);
  return P;
}`;

export const BODY_VERT = /* glsl */ `
vec3 smP0 = normalize(position);
vec3 smDirOut, smTmp;
vec3 smPos = smShape(smP0, smDirOut);
vSmDir = smDirOut;
vSmWY = smPos.y;
vec3 smTA = normalize(cross(smP0, abs(smP0.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
vec3 smTB = cross(smP0, smTA);
vec3 smPA = smShape(normalize(smP0 + smTA * 0.012), smTmp);
vec3 smPB = smShape(normalize(smP0 + smTB * 0.012), smTmp);
vec3 objectNormal = normalize(cross(smPA - smPos, smPB - smPos));
`;

export const FACE = /* glsl */ `
uniform vec2 uGaze, uEyeWH, uOpen, uLine;
uniform float uSplit, uEyeY, uArcK, uChev, uDiam, uSpiral, uPupil, uLid, uLidH, uCarve;
uniform float uEyeGlow, uEyeRoll, uSss, uRimI, uFleck, uFT, uBlush, uGroundY, uFlash;
uniform vec4 uBrow, uMouth, uMouth2, uMouth3;
uniform vec3 uEyeCol, uRimCol, uSssCol, uRimDir, uKeyDir, uFleckCol;
varying vec3 vSmDir;
varying float vSmWY;
vec3 smHash3(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float smSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float smEyeSDF(vec2 e, float open, float line, float side) {
  float op = max(open, 0.05);
  float d = (length(vec2(e.x, e.y / op)) - 1.0) * op;
  d = max(d, dot(e, normalize(vec2(side * uLid, 1.0))) - uLidH);
  d = max(d, -(length(e - vec2(0.0, -2.3 + 1.2 * uCarve)) - 1.25));
  float k = uArcK * 0.9, dl = 1e3;
  vec2 pa = vec2(-0.82, k * (0.6724 - 0.3));
  for (int j = 1; j <= 6; j++) { float x = -0.82 + float(j) * 0.2733; vec2 pb = vec2(x, k * (x * x - 0.3)); dl = min(dl, smSeg(e, pa, pb)); pa = pb; }
  d = mix(d, dl - 0.22, line);
  float dc = min(smSeg(e, vec2(side * 0.75, 0.72), vec2(-side * 0.72, 0.0)), smSeg(e, vec2(-side * 0.72, 0.0), vec2(side * 0.75, -0.72))) - 0.21;
  d = mix(d, dc, uChev);
  d = mix(d, (abs(e.x) * 1.08 + abs(e.y) - 1.0) * 0.62, uDiam);
  float r = length(e), a = atan(e.y, e.x * side);
  float s = r * 2.6 - a / 6.2832 - uFT * 0.9;
  d = mix(d, max((abs(fract(s) - 0.5) - 0.17) / 2.6, r - 1.05), uSpiral);
  return d;
}`;

export const FACE_FRAG = /* glsl */ `
float smEye = 0.0, smCore = 0.0, smHalo = 0.0, smSock = 0.0, smCatch = 0.0, smPup = 0.0, smBrow = 0.0, smBlushM = 0.0;
vec3 smD = normalize(vSmDir);
vec2 smUV = vec2(atan(smD.x, smD.z), asin(clamp(smD.y, -1.0, 1.0))) - uGaze;
{
  float cr = cos(uEyeRoll), sr = sin(uEyeRoll);
  smUV = mat2(cr, sr, -sr, cr) * smUV;
}
float smFadeZ = smoothstep(0.0, 0.35, smD.z);
float smRound = (1.0 - uChev) * (1.0 - uDiam) * (1.0 - uSpiral);
for (int i = 0; i < 2; i++) {
  float side = i == 0 ? -1.0 : 1.0;
  float line = i == 0 ? uLine.x : uLine.y;
  vec2 e = (smUV - vec2(side * uSplit, uEyeY)) / uEyeWH;
  float sd = smEyeSDF(e, i == 0 ? uOpen.x : uOpen.y, line, side);
  float aa = fwidth(sd) * 1.1 + 1e-4;
  float m = (1.0 - smoothstep(-aa, aa, sd)) * smFadeZ;
  float rnd = smRound * (1.0 - line);
  smEye = max(smEye, m);
  smCore = max(smCore, m * mix(0.6, 1.0 - smoothstep(0.0, 1.05, length(e * vec2(0.95, 0.72))), rnd));
  smHalo += exp(-max(sd, 0.0) * 4.0) * (1.0 - m) * smFadeZ;
  smSock = max(smSock, exp(-max(sd, 0.0) * 2.2) * smFadeZ);
  float pd = length((e - vec2(-side * 0.05, -0.08)) * vec2(1.0, 0.9)) - 0.5;
  smPup = max(smPup, m * (1.0 - smoothstep(-aa, aa, pd)) * uPupil * rnd);
  smCatch = max(smCatch, m * rnd * max(1.0 - smoothstep(0.1, 0.2, length(e - vec2(-0.3, 0.42))),
                                     uPupil * (1.0 - smoothstep(0.05, 0.11, length(e - vec2(0.26, -0.3))))));
  vec2 bp = smUV - vec2(side * (uSplit + 0.012), uEyeY + uEyeWH.y * 1.42 + (i == 0 ? uBrow.z : uBrow.w));
  float ang = -side * uBrow.y, cb = cos(ang), sb = sin(ang);
  bp = mat2(cb, -sb, sb, cb) * bp;
  float bd = length(vec2(max(abs(bp.x) - uEyeWH.x * 0.92, 0.0), bp.y)) - 0.019;
  float baa = fwidth(bd) * 1.1 + 1e-5;
  smBrow = max(smBrow, (1.0 - smoothstep(-baa, baa, bd)) * uBrow.x * smFadeZ);
  smSock = max(smSock, exp(-max(bd, 0.0) * 30.0) * uBrow.x * smFadeZ * 0.7);
  vec2 bq = (smUV - vec2(side * (uSplit + 0.1), uEyeY - uEyeWH.y * 1.1)) / vec2(0.085, 0.048);
  smBlushM += exp(-dot(bq, bq)) * smFadeZ;
}
vec2 smMP = smUV - vec2(uMouth2.w, uMouth.x);
{
  float ct = cos(uMouth2.z), st = sin(uMouth2.z);
  smMP = mat2(ct, -st, st, ct) * smMP;
}
float smMW = max(uMouth.y, 0.005);
float smXn = clamp(smMP.x / smMW, -1.0, 1.0);
float smYc = uMouth.z * smMW * 0.6 * (smXn * smXn - 0.35) + uMouth2.y * 0.011 * sin(smXn * 8.0 + uFT * 7.0)
           + uMouth3.x * 0.022 * (abs(fract(smXn * 2.0 + 0.25) * 2.0 - 1.0) * 2.0 - 1.0);
float smSl = uMouth.z * 1.2 * smXn;
float smDl = length(vec2(max(abs(smMP.x) - smMW, 0.0), (smMP.y - smYc) / sqrt(1.0 + smSl * smSl))) - 0.016;
float smDo = (length(smMP / vec2(smMW * 0.55, smMW * 0.68)) - 1.0) * smMW * 0.55;
float smDg = max((length((smMP - vec2(0.0, smMW * 0.1)) / vec2(smMW, smMW * 0.8)) - 1.0) * smMW * 0.8, smMP.y - smMW * 0.1 - uMouth.z * 0.03 * smXn * smXn);
float smMd = mix(mix(smDl, smDo, uMouth.w), smDg, uMouth2.x);
float smMaa = fwidth(smMd) * 1.1 + 1e-5;
float smMouth = (1.0 - smoothstep(-smMaa, smMaa, smMd)) * uMouth3.y * smFadeZ;
float smMEdge = smMouth * (1.0 - smoothstep(0.0, 0.02, -smMd));
smSock = max(smSock, exp(-max(smMd, 0.0) * 24.0) * smFadeZ * uMouth3.y * 0.8);
float smFeat = max(max(smEye, smBrow), smMouth);
vec3 smFp = smD * 17.0; vec3 smCell = floor(smFp); vec3 smH = smHash3(smCell);
float smFl = 0.0;
if (smH.x < uFleck) smFl = 1.0 - smoothstep(0.05, 0.11, length(fract(smFp) - (0.2 + 0.6 * smH.yzx)));
smFl *= (1.0 - smSock) * (0.5 + 0.5 * smH.z);
vec3 smV = normalize(vViewPosition);
float smF = 1.0 - clamp(dot(normal, smV), 0.0, 1.0);
float smAO = mix(0.3, 1.0, smoothstep(0.0, 0.6, vSmWY - uGroundY));
diffuseColor.rgb *= mix(0.55, 1.3, smoothstep(0.1, 0.85, smF));
diffuseColor.rgb = mix(diffuseColor.rgb, uFleckCol, smFl);
metalnessFactor = mix(metalnessFactor, 1.0, smFl);
roughnessFactor = mix(roughnessFactor, 0.2, smFl);
diffuseColor.rgb *= 1.0 - smSock * 0.5;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.008, 0.007, 0.004), smFeat);
roughnessFactor = mix(roughnessFactor, 0.05, smFeat);
`;

export const LIGHT_FRAG = /* glsl */ `
{
  float smNo = 1.0 - smFeat;
  float smRs = clamp(dot(normal, uRimDir) * 0.5 + 0.5, 0.0, 1.0);
  totalEmissiveRadiance += uRimCol * pow(smF, 3.2) * (0.1 + 0.9 * smRs * smRs) * uRimI * smNo;
  float smWrap = clamp((dot(normal, uKeyDir) + 0.6) / 1.6, 0.0, 1.0);
  float smBack = clamp(-dot(normal, uKeyDir) * 0.5 + 0.5, 0.0, 1.0);
  totalEmissiveRadiance += uSssCol * (pow(smF, 1.5) * 0.6 * (0.35 + 0.65 * smBack * smBack) + smWrap * smWrap * 0.07) * uSss * smNo * smAO;
  vec3 smGlow = uEyeCol * uEyeGlow;
  totalEmissiveRadiance += smGlow * (smEye * (1.0 - smPup) * (0.45 + 1.9 * smCore) + smHalo * 0.2);
  totalEmissiveRadiance += smGlow * (smBrow * 0.8 + smMouth * (0.35 + 1.1 * smMEdge));
  totalEmissiveRadiance += vec3(1.0, 0.96, 0.88) * smCatch * 2.6 * uEyeGlow;
  totalEmissiveRadiance += vec3(1.0, 0.4, 0.26) * smBlushM * 0.2 * uBlush * smNo;
  // appear: the body glows gold-white from inside, strongest at the rim, while it materializes
  totalEmissiveRadiance += vec3(1.0, 0.82, 0.5) * uFlash * (0.35 + 1.6 * pow(smF, 1.5));
}`;

export const AO_FRAG = /* glsl */ `
reflectedLight.indirectDiffuse *= smAO;
reflectedLight.indirectSpecular *= mix(1.0, smAO, 0.6);
reflectedLight.directDiffuse *= mix(1.0, smAO, 0.5);
`;

/* ------------------------------------------------------------ studio ---- */
// The dashboard's procedural photo studio: a dark green-grey sweep, a large softbox high left split
// by a window bar, a warm gold strip behind right, a cool strip left, a small front fill and a
// green floor bounce, plus its key / gold rim / cool fill directional lights. Evaluated in
// Sherwood's frame (uS2V rotates studio space into view space).
export const STUDIO_PARS = /* glsl */ `
uniform mat3 uS2V;
uniform vec3 uKeyC, uKeyV, uRimC, uRimV, uFillC, uFillV;
uniform float uStudioI, uHostI, uExpo, uCap;
uniform vec3 uPanC[5], uPanU[5], uPanW[5], uPanL[5], uPanE[5];
uniform vec2 uPanH[5];
vec3 smDome(vec3 r) {
  float k = clamp(r.y * 0.5 + 0.5, 0.0, 1.0); k = k * k * (3.0 - 2.0 * k);
  return mix(vec3(0.004, 0.008, 0.006), vec3(0.05, 0.075, 0.062), k);
}
float smEdgeF(float x, float s) { return clamp((x + s) / (0.12 + 2.0 * s), 0.0, 1.0); }
vec3 smStudioRad(vec3 r, float rough) {
  float s = rough * rough * 1.6;
  vec3 col = smDome(r);
  for (int i = 0; i < 5; i++) {
    vec3 c = uPanC[i]; float dc = length(c);
    float dn = dot(r, -c / dc);
    if (dn > -1e-3) continue;
    vec3 p = r * (-dc / dn) - c;
    vec2 uv = vec2(dot(p, uPanU[i]) / uPanH[i].x, dot(p, uPanW[i]) / uPanH[i].y) * 0.5 + 0.5;
    float a = smEdgeF(uv.x, s) * smEdgeF(1.0 - uv.x, s) * smEdgeF(uv.y, s) * smEdgeF(1.0 - uv.y, s);
    float bw = 0.031, be = 0.004 + s * 0.5;
    a *= 1.0 - 0.85 * (bw / (bw + s)) * (1.0 - smoothstep(bw - be, bw + be, abs(uv.x - 0.5)));
    col = mix(col, uPanL[i], a);
  }
  return col;
}
vec3 smStudioIrr(vec3 n) {
  float k = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 e = mix(vec3(0.01, 0.018, 0.014), vec3(0.05, 0.075, 0.062), k) * 3.14159;
  for (int i = 0; i < 5; i++) e += uPanE[i] * clamp((dot(n, normalize(uPanC[i])) + 0.25) / 1.25, 0.0, 1.0);
  return e;
}`;

export const STUDIO_LIGHT = /* glsl */ `
#include <lights_fragment_maps>
{
  // the host scene's own lights only tint Sherwood; the studio below is its real lighting
  reflectedLight.directDiffuse *= uHostI; reflectedLight.directSpecular *= uHostI; irradiance *= uHostI;
  IncidentLight smDL; smDL.visible = true;
  smDL.color = uKeyC; smDL.direction = uKeyV;
  RE_Direct( smDL, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  smDL.color = uRimC; smDL.direction = uRimV;
  RE_Direct( smDL, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  smDL.color = uFillC; smDL.direction = uFillV;
  RE_Direct( smDL, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  mat3 smV2S = transpose(uS2V);
  iblIrradiance += smStudioIrr(smV2S * geometryNormal) * uStudioI;
  radiance += smStudioRad(smV2S * reflect(-geometryViewDir, geometryNormal), material.roughness) * uStudioI;
  #ifdef USE_CLEARCOAT
  clearcoatRadiance += smStudioRad(smV2S * reflect(-geometryViewDir, geometryClearcoatNormal), material.clearcoatRoughness) * uStudioI;
  #endif
}`;

// exposure match: the dashboard rendered with NeutralToneMapping at 1.0; three's ACESFilmic scales by
// exposure / 0.6, so the site's ACES @ 1.1 is ~1.8x hotter. uExpo brings Sherwood back to the
// dashboard's brightness while its gold features stay above the bloom threshold.
// UnrealBloomPass passes the full colour of every pixel over its threshold, so the lacquer's
// softbox reflections would veil the whole blob. A soft knee holds each material under uCap
// (the body: just under the 1.02 threshold) and only SM_GLOW (the eyes) is allowed past it.
export const EXPO_FRAG = /* glsl */ `
#include <opaque_fragment>
{
  vec3 smC = gl_FragColor.rgb * uExpo;
  float smMx = max(max(smC.r, smC.g), max(smC.b, 1e-5));
  float smK = 0.6 * uCap;
  float smY = smMx < smK ? smMx : smK + (uCap - smK) * (1.0 - exp(-(smMx - smK) / (uCap - smK)));
  gl_FragColor.rgb = smC * mix(smY / smMx, 1.0, SM_GLOW);
}`;
