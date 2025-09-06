import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the EventManager contract along with MockUSDC token
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployEventManager: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Deploy Mock USDC token first
  const mockUSDC = await deploy("MockUSDC", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  // Deploy EventManager contract
  const eventManager = await deploy("EventManager", {
    from: deployer,
    args: [mockUSDC.address, deployer], // token address and owner
    log: true,
    autoMine: true,
  });

  // Get the deployed contracts
  const usdcContract = await hre.ethers.getContract<Contract>("MockUSDC", deployer);
  const eventManagerContract = await hre.ethers.getContract<Contract>("EventManager", deployer);

  console.log("🪙 MockUSDC deployed at:", mockUSDC.address);
  console.log("🎫 EventManager deployed at:", eventManager.address);

  // Check initial configuration
  const attendeeDeposit = await eventManagerContract.attendeeDepositAmount();
  const organizerBond = await eventManagerContract.organizerBondAmount();
  const minAttendanceRatio = await eventManagerContract.minAttendanceRatio();

  console.log("📏 Initial configuration:");
  console.log("  Attendee Deposit Amount:", attendeeDeposit.toString());
  console.log("  Organizer Bond Amount:", organizerBond.toString());
  console.log("  Min Attendance Ratio:", minAttendanceRatio.toString(), "bps");

  // Check USDC balance of deployer
  const balance = await usdcContract.balanceOf(deployer);
  console.log("💰 Deployer USDC balance:", balance.toString());
};

export default deployEventManager;

deployEventManager.tags = ["EventManager", "MockUSDC"];
