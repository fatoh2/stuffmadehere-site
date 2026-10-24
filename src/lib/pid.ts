/** A PID controller acting on a unit mass: returns an acceleration. */
export class PID {
  kp: number;
  ki: number;
  kd: number;
  integral = 0;
  integralLimit: number;

  constructor(kp: number, ki: number, kd: number, integralLimit = 400) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this.integralLimit = integralLimit;
  }

  reset(): void {
    this.integral = 0;
  }

  /** error = setpoint - process value; vel = current velocity of the process value */
  step(error: number, vel: number, dt: number): number {
    this.integral += error * dt;
    const L = this.integralLimit;
    if (this.integral > L) this.integral = L;
    else if (this.integral < -L) this.integral = -L;
    return this.kp * error + this.ki * this.integral - this.kd * vel;
  }
}
