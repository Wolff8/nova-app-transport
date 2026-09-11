/* eslint-disable no-constant-condition */
export interface DecodedVehicle {
  vehicleId?: string | null;
  routeId: string | null;
  tripId: string | null;
  lat: number;
  lon: number;
  speed: number | null;
  bearing?: number | null;
  timestamp: number;
}

export function decodeVehiclePositions(bytes: Uint8Array): DecodedVehicle[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: DecodedVehicle[] = [];
  let pos = 0;
  const END = view.byteLength;

  const vi = () => {
    let x = 0, mul = 1;
    for (;;) {
      const b = view.getUint8(pos++);
      x += (b & 0x7f) * mul;
      if (!(b & 0x80)) return x >= 0 ? x : x + 4294967296;
      mul *= 128;
    }
  };

  const tag = () => {
    const t = vi();
    return [Math.floor(t / 8), t % 8];
  };

  const readLen = () => vi();

  const str = () => {
    const n = readLen();
    const s = new TextDecoder().decode(new Uint8Array(view.buffer, view.byteOffset + pos, n));
    pos += n;
    return s;
  };

  const skip = (w: number) => {
    if (w === 0) vi();
    else if (w === 1) pos += 8;
    else if (w === 5) pos += 4;
    else if (w === 2) {
      const n = readLen();
      pos += n;
    }
  };

  while (pos < END) {
    const [f, w] = tag();
    if (f === 2 && w === 2) {
      const entLen = readLen();
      const entEnd = pos + entLen;
      let v: DecodedVehicle | null = null;
      let entityId: string | null = null;
      
      while (pos < entEnd) {
        const [ef, ew] = tag();
        if (ef === 1 && ew === 2) {
          entityId = str();
        } else if (ef === 4 && ew === 2) {
          const vpLen = readLen();
          const vpEnd = pos + vpLen;
          const rec: DecodedVehicle = { vehicleId: entityId, tripId: null, routeId: null, lat: 0, lon: 0, speed: null, bearing: null, timestamp: 0 };
          
          while (pos < vpEnd) {
            const [vf, vw] = tag();
            if (vf === 1 && vw === 2) {
              const tdLen = readLen();
              const tdEnd = pos + tdLen;
              while (pos < tdEnd) {
                const [tf, tw] = tag();
                if (tf === 1 && tw === 2) rec.tripId = str();
                else if (tf === 5 && tw === 2) rec.routeId = str();
                else skip(tw);
              }
            } else if (vf === 2 && vw === 2) {
              const pLen = readLen();
              const pEnd = pos + pLen;
              while (pos < pEnd) {
                const [pf, pw] = tag();
                if (pf === 1 && pw === 5) { rec.lat = view.getFloat32(pos, true); pos += 4; }
                else if (pf === 2 && pw === 5) { rec.lon = view.getFloat32(pos, true); pos += 4; }
                else if (pf === 4 && pw === 5) { rec.bearing = view.getFloat32(pos, true); pos += 4; }
                else if (pf === 5 && pw === 5) { rec.speed = view.getFloat32(pos, true); pos += 4; }
                else skip(pw);
              }
            } else if (vf === 3 && vw === 2) {
              // Vehicle descriptor
              const vdLen = readLen();
              const vdEnd = pos + vdLen;
              while (pos < vdEnd) {
                const [df, dw] = tag();
                if (df === 1 && dw === 2) rec.vehicleId = str();
                else skip(dw);
              }
            } else if (vf === 5 && vw === 0) {
              rec.timestamp = vi();
            } else skip(vw);
          }
          v = rec;
        } else skip(ew);
      }
      if (v && v.lat && v.lon) out.push(v);
      pos = entEnd;
    } else skip(w);
  }
  return out;
}
