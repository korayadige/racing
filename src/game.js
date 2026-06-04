import Car from "./Car.js";

class CarPhysicsScene extends Phaser.Scene {
  constructor() {
    super("CarPhysicsScene");
  }

  create() {
    this.worldScale = parseInt(import.meta.env.VITE_WORLD_SCALE) || 30;
    this.mapWidth = parseInt(import.meta.env.VITE_MAP_WIDTH) || 1000;
    this.mapHeight = parseInt(import.meta.env.VITE_MAP_HEIGHT) || 700;

    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.physicsWorldWidthMeters = this.mapWidth / this.worldScale;
    this.physicsWorldHeightMeters = this.mapHeight / this.worldScale;

    this.world = planck.World(planck.Vec2(0, 0));
    this.cursors = this.input.keyboard.createCursorKeys();

    const carW = parseInt(import.meta.env.VITE_CAR_WIDTH) || 34;
    const carH = parseInt(import.meta.env.VITE_CAR_HEIGHT) || 65;

    // Instantiate Car from imported module definition
    this.car = new Car(
      this.world,
      this.mapWidth / 2,
      this.mapHeight / 2,
      carW,
      carH,
      this.worldScale,
    );

    this.obstacles = [];
    this.createBoxObstacle(350, 350, 60, 200, 0x444444);
    this.createBoxObstacle(650, 350, 60, 200, 0x444444);

    let boundaries = this.world.createBody();
    boundaries.createFixture(
      planck.Chain(
        [
          planck.Vec2(0, 0),
          planck.Vec2(0, this.physicsWorldHeightMeters),
          planck.Vec2(
            this.physicsWorldWidthMeters,
            this.physicsWorldHeightMeters,
          ),
          planck.Vec2(this.physicsWorldWidthMeters, 0),
        ],
        true,
      ),
      { friction: 0.2, restitution: 0.3 },
    );

    this.environmentGraphics = this.add.graphics();
    this.renderGraphics = this.add.graphics();
    this.drawStaticEnvironment();
  }

  createBoxObstacle(x, y, width, height, color) {
    let body = this.world.createBody({
      type: "static",
      position: planck.Vec2(x / this.worldScale, y / this.worldScale),
    });
    body.createFixture(
      planck.Box(width / 2 / this.worldScale, height / 2 / this.worldScale),
      { friction: 0.6 },
    );
    this.obstacles.push({ body, type: "box", w: width, h: height, color });
  }

  createCircleObstacle(x, y, radius, color) {
    let body = this.world.createBody({
      type: "dynamic",
      position: planck.Vec2(x / this.worldScale, y / this.worldScale),
      linearDamping: 3.5,
      angularDamping: 3.5,
    });
    body.createFixture(planck.Circle(radius / this.worldScale), {
      density: 2.0,
      friction: 0.4,
      restitution: 0.6,
    });
    this.obstacles.push({ body, type: "circle", r: radius, color });
  }

  drawStaticEnvironment() {
    this.environmentGraphics.clear();
    this.environmentGraphics.fillStyle(0x282c34, 1);
    this.environmentGraphics.fillRect(0, 0, this.mapWidth, this.mapHeight);

    const curbWidth = 15;
    this.environmentGraphics.lineStyle(curbWidth, 0xcc3333, 1);
    this.environmentGraphics.strokeRect(
      curbWidth / 2,
      curbWidth / 2,
      this.mapWidth - curbWidth,
      this.mapHeight - curbWidth,
    );

    this.environmentGraphics.lineStyle(4, 0xffffff, 0.8);
    this.environmentGraphics.strokeRect(
      40,
      40,
      this.mapWidth - 80,
      this.mapHeight - 80,
    );
  }

  update(time, delta) {
    const controls = {
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      handbrake: this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE,
      ).isDown,
    };

    this.car.update(controls, delta);
    this.world.step(1 / 60);
    this.world.clearForces();

    this.renderGraphics.clear();
    this.drawSceneElements();
  }

  drawSceneElements() {
    // 1. Draw Environmental Obstacles
    this.obstacles.forEach((obs) => {
      const pos = obs.body.getPosition();
      const angle = obs.body.getAngle();

      // Use Phaser's native matrix transformation pipeline
      this.renderGraphics.save();
      this.renderGraphics.translateCanvas(
        pos.x * this.worldScale,
        pos.y * this.worldScale,
      );

      // FIXED: Phaser Graphics context uses 'rotateCanvas', not 'rotate'
      this.renderGraphics.rotateCanvas(angle);

      this.renderGraphics.fillStyle(obs.color, 1);
      this.renderGraphics.lineStyle(2, 0xffffff, 0.3);

      if (obs.type === "box") {
        this.renderGraphics.fillRect(-obs.w / 2, -obs.h / 2, obs.w, obs.h);
        this.renderGraphics.strokeRect(-obs.w / 2, -obs.h / 2, obs.w, obs.h);
      } else if (obs.type === "circle") {
        this.renderGraphics.fillCircle(0, 0, obs.r);
        this.renderGraphics.strokeCircle(0, 0, obs.r);
        this.renderGraphics.lineStyle(3, 0xffffff, 0.6);
        this.renderGraphics.lineBetween(0, 0, obs.r, 0);
      }
      this.renderGraphics.restore();
    });

    // 2. Draw Car Tires
    this.car.tires.forEach((tire) => {
      const pos = tire.body.getPosition();
      const angle = tire.body.getAngle();

      this.renderGraphics.save();
      this.renderGraphics.translateCanvas(
        pos.x * this.worldScale,
        pos.y * this.worldScale,
      );

      // FIXED: Changed to 'rotateCanvas'
      this.renderGraphics.rotateCanvas(angle);

      this.renderGraphics.fillStyle(tire.isSliding ? 0xe0a814 : 0x111111, 1);
      this.renderGraphics.fillRect(
        -tire.width / 2,
        -tire.height / 2,
        tire.width,
        tire.height,
      );
      this.renderGraphics.restore();
    });

    // 3. Draw Vehicle Body Frame (Chassis)
    const carPos = this.car.chassis.getPosition();
    const carAngle = this.car.chassis.getAngle();

    this.renderGraphics.save();
    this.renderGraphics.translateCanvas(
      carPos.x * this.worldScale,
      carPos.y * this.worldScale,
    );

    // FIXED: Changed to 'rotateCanvas'
    this.renderGraphics.rotateCanvas(carAngle);

    this.renderGraphics.fillStyle(0xde3535, 1);
    this.renderGraphics.fillRect(
      -this.car.width / 2,
      -this.car.height / 2,
      this.car.width,
      this.car.height,
    );

    this.renderGraphics.fillStyle(0xaae6ff, 0.8);
    this.renderGraphics.fillRect(
      -this.car.width * 0.35,
      -this.car.height * 0.25,
      this.car.width * 0.7,
      this.car.height * 0.15,
    );
    this.renderGraphics.restore();
  }
}

const config = {
  type: Phaser.AUTO,
  width: parseInt(import.meta.env.VITE_MAP_WIDTH) || 1000,
  height: parseInt(import.meta.env.VITE_MAP_HEIGHT) || 700,
  parent: "game-container",
  scene: CarPhysicsScene,
};

const game = new Phaser.Game(config);
