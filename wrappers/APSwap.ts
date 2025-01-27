import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider, Dictionary, DictionaryValue,
    Sender,
    SendMode, toNano
} from 'ton-core';

export type APSwapConfig = {
    JettonMasterAddress: Address;
    ADMIN_ADDRESS: Address;
    MINER_ADDRESS: Address;
    start: number;
};

const CellRef: DictionaryValue<Cell> = {
    serialize: (src, builder) => {
        builder.storeSlice(src.beginParse())
    },
    parse: (src) => src.asCell(),
}

export function tonnelConfigToCell(config: APSwapConfig): Cell {

    return beginCell().storeAddress(config.JettonMasterAddress)
        .storeAddress(config.ADMIN_ADDRESS)
        .storeAddress(config.MINER_ADDRESS)
        .storeUint(config.start, 32)
        .storeCoins(0)
        .endCell();

}

export const Opcodes = {
    swap: 0x777,
    set_miner: 0x666,
};
export const ERRORS = {

};

export class APSwap implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {
    }

    static createFromAddress(address: Address) {
        return new APSwap(address);
    }

    static createFromConfig(config: APSwapConfig, code: Cell, workchain = 0) {
        const data = tonnelConfigToCell(config);
        const init = {code, data};
        return new APSwap(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendSwap(provider: ContractProvider, via: Sender, value: bigint, howMuch: bigint, to: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Opcodes.swap, 32)
                .storeUint(0, 64)
                .storeCoins(howMuch).
                storeAddress(to).endCell(),
        });
    }

    async sendSetMiner(provider: ContractProvider, via: Sender, value: bigint, to: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(Opcodes.set_miner, 32)
                .storeUint(0, 64)
                .storeAddress(to).endCell(),
        });
    }

    async getBalance(provider: ContractProvider) {
        const result = await provider.getState();
        return result.balance;
    }

    async getExpectedReturn(provider: ContractProvider, amount: bigint) {
        const result = await provider.get('get_expected_return', [
            {type: 'int', value: amount},
        ]);
        return result.stack.readBigNumber();
    }


    async getTONNELVirtualBalance(provider: ContractProvider) {
        const result = await provider.get('get_tonnel_virtual_balance', []);
        return result.stack.readBigNumber();
    }


    async getTokenSold(provider: ContractProvider) {
        const result = await provider.get('get_token_sold', []);
        return result.stack.readBigNumber();
    }


}
