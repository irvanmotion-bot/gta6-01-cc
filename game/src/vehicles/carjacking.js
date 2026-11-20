// Getting into and out of cars: stealing a parked one, pulling a driver out, and bailing from a moving one.
import { PLAYER } from '../core/config.js';

/** The car F would take right now: the nearest one in reach that is not a wreck. */
export function carInReach(game) {
  const player = game.player;
  return game.vehicles.nearest(player.position.x, player.position.z, PLAYER.enterRange, (v) => v.driver !== 'cop' || v.spec.police);
}

/**
 * Point out the car in reach of a player on foot: an amber ring on the road round it and the key prompt that says
 * what F will do to it: take a parked car, steal one, or pull its driver out.
 */
export function promptCarInReach(game) {
  const car = carInReach(game);
  if (!car) return null;
  const mine = car.stolen || car.missionOwned;
  const crewOut = car.controller && car.controller.deployed;
  if (car.driver === 'cop' && !crewOut) game.hud.hint(`${car.spec.name}: officers inside`);
  else game.hud.hint(car.driver === 'ai' ? `Press F to carjack the ${car.spec.name}` : mine ? `Press F to drive the ${car.spec.name}` : `Press F to steal the ${car.spec.name}`);
  game.markers.show(car.position.x, car.position.z, car.driver === 'cop' && !crewOut ? '#ff6a4d' : '#ffb547', car.spec.length * 0.62, 0.4);
  return car;
}

/** Enter the nearest car in reach; an AI driver is thrown out and runs, which the police count as a crime. */
export function tryEnterVehicle(game) {
  const player = game.player;
  const vehicle = carInReach(game);
  if (!vehicle) return false;
  const crewOut = vehicle.controller && vehicle.controller.deployed;
  if (vehicle.driver === 'cop' && !crewOut) { game.hud.notify('The officers inside are not giving this one up.'); return false; }
  if (vehicle.driver === 'cop') { vehicle.driver = null; vehicle.stolen = false; }
  if (vehicle.driver === 'ai') {
    const side = doorSide(game, vehicle);
    game.pedestrians.spawnFleeing(side.x, side.z, player.position);
    game.wanted.reportCrime('carjack');
    game.stats.carsStolen += 1;
    game.audio.carDoor();
  } else if (!vehicle.stolen && !vehicle.missionOwned) {
    game.stats.carsStolen += 1;
    if (vehicle.spec.police) game.wanted.reportCrime('stealPolice');
    else game.wanted.reportCrime('stealParked');
  }
  vehicle.controller = null;
  vehicle.parked = false;
  vehicle.driver = 'player';
  vehicle.stolen = true;
  vehicle.siren = false;
  player.vehicle = vehicle;
  player.mesh.visible = false;
  player.aiming = false;
  game.audio.carDoor();
  game.hud.showVehicleName(vehicle.spec.name, vehicle.spec.kind);
  game.onPlayerEnteredVehicle(vehicle);
  return true;
}

/** A free spot beside the driver's door, or the other side when a wall blocks it. */
function doorSide(game, vehicle) {
  const reach = vehicle.spec.width / 2 + 0.9;
  const leftX = vehicle.forwardZ();
  const leftZ = -vehicle.forwardX();
  for (const sign of [1, -1]) {
    const x = vehicle.position.x + leftX * reach * sign;
    const z = vehicle.position.z + leftZ * reach * sign;
    if (!game.collision.resolveCircle(x, z, 0.4, 0.5)) return { x, z };
  }
  return { x: vehicle.position.x - vehicle.forwardX() * (vehicle.spec.length / 2 + 1), z: vehicle.position.z - vehicle.forwardZ() * (vehicle.spec.length / 2 + 1) };
}

/** Step out beside the car; jumping out at speed hurts. `forced` skips the stunt damage (a wreck, an arrest). */
export function leaveVehicle(game, forced = false) {
  const player = game.player;
  const vehicle = player.vehicle;
  if (!vehicle) return;
  const side = doorSide(game, vehicle);
  const speed = Math.abs(vehicle.speed);
  vehicle.driver = null;
  vehicle.setControls(0, 0, true);
  player.vehicle = null;
  player.mesh.visible = true;
  player.position.set(side.x, vehicle.position.y, side.z);
  player.heading = vehicle.heading;
  if (!forced) game.audio.carDoor();
  if (!forced && speed > 11) {
    player.flingX = vehicle.velX * 0.6;
    player.flingZ = vehicle.velZ * 0.6;
    player.velY = 3;
    player.takeDamage(speed * 0.9, 'bail');
    game.hud.notify('You bailed out at speed.');
  }
  game.onPlayerLeftVehicle(vehicle);
}
