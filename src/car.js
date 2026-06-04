import Tire from "./Tire.js";

export default class Car {
  constructor(world, x, y, width, height, scale) {
    this.world = world;
    this.scale = scale;
    this.width = width;
    this.height = height;

    this.chassisWidthMeters = width / scale;
    this.chassisHeightMeters = height / scale;

    this.chassis = this.world.createBody({
      type: "dynamic",
      position: planck.Vec2(x / scale, y / scale),
      linearDamping: 0.5,
      angularDamping: 1.0,
    });

    this.chassis.createFixture({
      shape: planck.Box(
        this.chassisWidthMeters / 2,
        this.chassisHeightMeters / 2,
      ),
      density: 1.0,
      friction: 0.3,
      restitution: 0.1,
    });

    this.tires = [];
    const tireW = width * 0.2;
    const tireH = height * 0.2;

    const offsetX = width / 2;
    const offsetY = height / 2 - tireH * 0.5;

    this.tires.push(
      new Tire(
        world,
        x - offsetX,
        y - offsetY,
        tireW,
        tireH,
        true,
        true,
        scale,
      ),
    );
    this.tires.push(
      new Tire(
        world,
        x + offsetX,
        y - offsetY,
        tireW,
        tireH,
        false,
        true,
        scale,
      ),
    );
    this.tires.push(
      new Tire(
        world,
        x - offsetX,
        y + offsetY,
        tireW,
        tireH,
        true,
        false,
        scale,
      ),
    );
    this.tires.push(
      new Tire(
        world,
        x + offsetX,
        y + offsetY,
        tireW,
        tireH,
        false,
        false,
        scale,
      ),
    );

    this.joints = [];
    this.tires.forEach((tire) => {
      let jointDef = {
        bodyA: this.chassis,
        bodyB: tire.body,
        localAnchorA: this.chassis.getLocalPoint(tire.body.getPosition()),
        localAnchorB: planck.Vec2(0, 0),
        referenceAngle: 0,
        enableLimit: true,
        lowerAngle: 0,
        upperAngle: 0,
      };

      if (tire.isFront) {
        jointDef.lowerAngle = -Math.PI / 5;
        jointDef.upperAngle = Math.PI / 5;
      }

      const joint = this.world.createJoint(planck.RevoluteJoint(jointDef));
      this.joints.push(joint);
    });

    this.maxSteerAngle = Math.PI / 5;
    this.steerSpeed = 2.0;
  }

  update(controls, deltaTime) {
    let targetAngle = 0;
    if (controls.left) targetAngle = -this.maxSteerAngle;
    else if (controls.right) targetAngle = this.maxSteerAngle;

    this.tires.forEach((tire, index) => {
      tire.updateFriction(controls.handbrake);

      if (tire.isFront) {
        const joint = this.joints[index];
        let currentAngle = joint.getJointAngle();
        let angleToTurn = targetAngle - currentAngle;

        let limit = this.steerSpeed * (deltaTime / 1000);
        angleToTurn = Phaser.Math.Clamp(angleToTurn, -limit, limit);

        let newAngle = currentAngle + angleToTurn;
        joint.setLimits(newAngle, newAngle);
      }

      if (!tire.isFront) {
        if (!controls.handbrake) tire.updateDrive(controls);
      }
    });
  }
}
