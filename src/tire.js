export default class Tire {
  constructor(world, x, y, width, height, isLeft, isFront, scale) {
    this.world = world;
    this.scale = scale;
    this.isLeft = isLeft;
    this.isFront = isFront;
    this.width = width;
    this.height = height;

    this.body = this.world.createBody({
      type: "dynamic",
      position: planck.Vec2(x / scale, y / scale),
      linearDamping: 0.8,
      angularDamping: 1.0,
    });

    this.body.createFixture({
      shape: planck.Box(width / 2 / scale, height / 2 / scale),
      density: 1.0,
      friction: 0.5,
      restitution: 0.1,
    });

    this.maxForwardSpeed =
      parseFloat(import.meta.env.VITE_MAX_FORWARD_SPEED) || 35.0;
    this.maxBackwardSpeed = -12.0;
    this.maxDriveForce =
      parseFloat(import.meta.env.VITE_MAX_DRIVE_FORCE) || 60.0;
    this.normalMaxLateralImpulse = 3.5;
    this.driftMaxLateralImpulse = 0.8;
    this.isSliding = false;
  }

  getForwardVector() {
    return this.body.getWorldVector(planck.Vec2(0, -1));
  }

  getRightVector() {
    return this.body.getWorldVector(planck.Vec2(1, 0));
  }

  getLateralVelocity() {
    const currentRightNormal = this.getRightVector();
    const currentVelocity = this.body.getLinearVelocity();
    const dotProduct = planck.Vec2.dot(currentRightNormal, currentVelocity);
    return planck.Vec2(
      currentRightNormal.x * dotProduct,
      currentRightNormal.y * dotProduct,
    );
  }

  getForwardVelocity() {
    const currentForwardNormal = this.getForwardVector();
    const currentVelocity = this.body.getLinearVelocity();
    const dotProduct = planck.Vec2.dot(currentForwardNormal, currentVelocity);
    return planck.Vec2(
      currentForwardNormal.x * dotProduct,
      currentForwardNormal.y * dotProduct,
    );
  }

  killLateralVelocity(handbrakeActive) {
    let lateralVel = this.getLateralVelocity();
    let impulse = planck.Vec2.mul(lateralVel, -this.body.getMass());
    let impulseLength = impulse.length();

    let maxGrip = this.normalMaxLateralImpulse;
    if (handbrakeActive && !this.isFront) {
      maxGrip = 0.2;
    } else if (this.isSliding) {
      maxGrip = this.driftMaxLateralImpulse;
    }

    if (impulseLength > maxGrip) {
      this.isSliding = true;
      impulse.mul(maxGrip / impulseLength);
    } else {
      this.isSliding = false;
    }
    this.body.applyLinearImpulse(impulse, this.body.getWorldCenter(), true);
  }

  updateDrive(controls) {
    let desiredSpeed = 0;
    if (controls.up) desiredSpeed = this.maxForwardSpeed;
    else if (controls.down) desiredSpeed = this.maxBackwardSpeed;
    else return;

    const currentForwardNormal = this.getForwardVector();
    const currentSpeed = planck.Vec2.dot(
      this.getForwardVelocity(),
      currentForwardNormal,
    );

    let force = 0;
    if (desiredSpeed > currentSpeed) force = this.maxDriveForce;
    else if (desiredSpeed < currentSpeed) force = -this.maxDriveForce;

    if (this.isSliding && !this.isFront && controls.up) {
      force *= 1.4;
    }
    this.body.applyForce(
      planck.Vec2.mul(currentForwardNormal, force),
      this.body.getWorldCenter(),
      true,
    );
  }

  updateFriction(handbrakeActive) {
    this.killLateralVelocity(handbrakeActive);
    const currentForwardNormal = this.getForwardVector();
    const currentForwardSpeed = planck.Vec2.dot(
      this.getForwardVelocity(),
      currentForwardNormal,
    );
    let dragCoefficient = handbrakeActive && !this.isFront ? -2.0 : -0.4;
    let dragForceMagnitude = dragCoefficient * currentForwardSpeed;
    this.body.applyForce(
      planck.Vec2.mul(currentForwardNormal, dragForceMagnitude),
      this.body.getWorldCenter(),
      true,
    );
  }
}
