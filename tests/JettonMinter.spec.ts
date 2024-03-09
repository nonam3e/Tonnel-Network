import { Blockchain, SandboxContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonWallet } from '../wrappers/JettonWallet';

describe('JettonMinter', () => {
    let code: Cell;
    let codeWallet: Cell;

    beforeAll(async () => {
        code = await compile('JettonMinter');
        codeWallet = await compile('JettonWallet');
    });

    let blockchain: Blockchain;
    let jettonMinter: SandboxContract<JettonMinter>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        jettonMinter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    adminAddress: (await blockchain.treasury('owner')).address,
                    content: 'https://api.tonnel.network/jetton/metadata',
                    jettonWalletCode: codeWallet,
                },
                code
            )
        );

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await jettonMinter.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMinter.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy and mint', async () => {
        const owner = await blockchain.treasury('owner');
        const sender = await blockchain.treasury('sender');
        const transferDest = await blockchain.treasury('transfer');
        const mintResult = await jettonMinter.sendMint(sender.getSender(), {
            toAddress: owner.address,
            jettonAmount: toNano('1'),
            amount: toNano('0.02'),
            queryId: 1,
            value: toNano('0.05'),
        });
        expect(mintResult.transactions).toHaveTransaction({
            from: sender.address,
            to: jettonMinter.address,
            success: false,
        });

        await jettonMinter.sendMintAccess(owner.getSender(), {
            value: toNano('0.02'),
            queryId: 0,
            mintAccess: sender.address,
        });

        const mintResult2 = await jettonMinter.sendMint(sender.getSender(), {
            toAddress: owner.address,
            jettonAmount: toNano('1'),
            amount: toNano('0.02'),
            queryId: 1,
            value: toNano('0.05'),
        });
        expect(mintResult2.transactions).toHaveTransaction({
            from: sender.address,
            to: jettonMinter.address,
            success: true,
        });

        await jettonMinter.sendDeleteMintAccess(owner.getSender(), {
            value: toNano('0.02'),
            queryId: 0,
            mintAccess: sender.address,
        });

        const mintResult3 = await jettonMinter.sendMint(sender.getSender(), {
            toAddress: owner.address,
            jettonAmount: toNano('1'),
            amount: toNano('0.02'),
            queryId: 1,
            value: toNano('0.05'),
        });
        expect(mintResult3.transactions).toHaveTransaction({
            from: sender.address,
            to: jettonMinter.address,
            success: false,
        });

        const totalSupply = await jettonMinter.getTotalsupply();
        expect(totalSupply).toEqual(toNano('1'));
        const jettonWallet = await blockchain.openContract(
            JettonWallet.createFromAddress(await jettonMinter.getWalletAddress(owner.address))
        );
        const balance = await jettonWallet.getBalance();
        expect(balance).toEqual(toNano('1'));

        const transferResult = await jettonWallet.sendTransfer(owner.getSender(), {
            value: toNano('0.07'),
            toAddress: transferDest.address,
            queryId: 2,
            fwdAmount: toNano('0.02'),
            jettonAmount: toNano('0.5'),
            fwdPayload: beginCell().storeUint(1, 2).endCell(),
        });
        expect(transferResult.transactions).toHaveTransaction({
            from: owner.address,
            to: jettonWallet.address,
            success: true,
        });
        expect(await jettonWallet.getBalance()).toEqual(toNano('0.5'));
    });
});
