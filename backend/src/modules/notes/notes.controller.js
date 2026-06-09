/**
 * Notes Controller
 */
import service from "./notes.service.js";
import { apiResponse } from "../../utils/index.js";
import logger from "../../config/logger.js";
import config from "./notes.config.js";
import dbStore from "../../config/db_store.js";
import storeService from "../store/storeService.js";
import noteCategoriesService from "../note_categories/noteCategories.service.js";
import UserService from "../user/user.service.js";

const userService = new UserService();

export const getAll = async (req, res) => {
  try {
    const data = await service.getAll();
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const remove = async (req, res) => {
  try {
    const { unixKey } = req.params;
    await service.remove(unixKey);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const autoNoteVirtMrg = async (req, res) => {
  const tableName = `saldovirtual`;
  const pic = req.user?.username || "system";
  try {
    logger.info(`[autoNoteVirtMrg] Auto note process started, ensuring store service data is initialized first.`);
    await storeService.ensureInitialized();
    const { cabang, kdtk, prdcd, tanggal } = req.body;

    logger.info(`[autoNoteVirtMrg] getting store info for KDTK: ${kdtk} from store service.`);
    const storeInfo = await storeService.getStoreByCode(kdtk);

    if (!storeInfo) {
      logger.error(`[autoNoteVirtMrg] Store with KDTK: ${kdtk} not found.`);
      return apiResponse.noContent(res, `Store with KDTK ${kdtk} not found`);
    }

    try {
      logger.info(`[autoNoteVirtMrg] opening DB connection to store DB at store: ${storeInfo.storeCode}`);
      const storeConnection = await dbStore.createDbStore(storeInfo.dbHost, 2);
      //set unixKey for the note
      const unixKey = `${kdtk}${tanggal}${prdcd}`;

      if (storeConnection) {
        logger.info(`[autoNoteVirtMrg] DB connection established, querying for rekon virtual margin data.`);
        const [checkRmb] = await storeConnection.query(config.autoNotes.checkQtyRmb, [prdcd, tanggal]);
        if (checkRmb[0]?.COUNT > 0) {
          logger.info(`[autoNoteVirtMrg] RMB validation passed: ${checkRmb[0].COUNT} records found!.`);

          //processing auto note
          const strKeterOri = checkRmb[0].ERROR_MSG;
          const splitKeter = strKeterOri.split("|");
          const [codeCategory, noteCategory] = splitKeter.map(s => s.trim());

          const noteData = {
            Cabang: cabang,
            unixKey,
            noteText: noteCategory || "",
            pic: pic,
            categoryId: codeCategory || null,
            tableName: tableName,
          };

          // call reuse logic
          const resultupdNote = await service.upsert(noteData);
          //convert categoryId to integer
          const strCategoryId = codeCategory ? parseInt(codeCategory) : null;

          let category = null;
          if (strCategoryId) {
            const categoryResult = await noteCategoriesService.getAll();
            const categories = categoryResult.data || [];
            category = categories.find(c => c.id === strCategoryId) || null;
          }

          const user = await userService.findByCredentials(pic);
          const rslt = { ...resultupdNote.toJSON(), category, fullName: user?.fullName || null };
          return apiResponse.success(res, {
            message: `Auto note processed successfully for ${kdtk}`,
            data: rslt,
          });
        }

        const [result] = await storeConnection.query(config.autoNotes.rekonVirtualMrg, [
          tanggal,
          prdcd,
          tanggal,
          prdcd,
        ]);

        if (result.length > 0) {
          logger.info(`[autoNoteVirtMrg] Data found: , ${result.length} records. Proceeding to`);
          //processing auto note
          const strKeterOri = result[0].keterangan;
          const splitKeter = strKeterOri.split("|");
          const [codeCategory, noteCategory] = splitKeter.map(s => s.trim());

          logger.info(
            `[autoNoteVirtMrg] Preparing to save or update and autonote for kdtk ${kdtk} on prdcd ${prdcd} for date ${tanggal}`,
          );
          const noteData = {
            Cabang: cabang,
            unixKey,
            noteText: noteCategory || "",
            pic: pic,
            categoryId: codeCategory || null,
            tableName: tableName,
          };
          // call reuse logic
          const resultupdNote = await service.upsert(noteData);

          //convert categoryId to integer
          const strCategoryId = codeCategory ? parseInt(codeCategory) : null;

          let category = null;
          if (strCategoryId) {
            const categoryResult = await noteCategoriesService.getAll();
            const categories = categoryResult.data || [];
            category = categories.find(c => c.id === strCategoryId) || null;
          }

          const user = await userService.findByCredentials(pic);
          const rslt = { ...resultupdNote.toJSON(), category, fullName: user?.fullName || null };

          return apiResponse.success(res, {
            message: `Auto note processed successfully for ${kdtk}`,
            data: rslt,
          });
        } else {
          logger.info(
            `[autoNoteVirtMrg] DB connection established, querying for rekon virtual margin data using query dede sulaiman.`,
          );
          const [result] = await storeConnection.query(config.autoNotes.rekonVirtualMrgDelon, [
            tanggal,
            prdcd,
            tanggal,
            prdcd,
          ]);

          if (result.length > 0) {
            logger.info(
              `[autoNoteVirtMrg] Data found from query dede sulaiman: , ${result.length} records. Proceeding to`,
            );
            //processing auto note
            const strKeterOri = result[0].keterangan;
            const splitKeter = strKeterOri.split("|");
            const [codeCategory, noteCategory] = splitKeter.map(s => s.trim());

            logger.info(
              `[autoNoteVirtMrg] Preparing to save or update and autonote for kdtk ${kdtk} on prdcd ${prdcd} for date ${tanggal}`,
            );
            const unixKey = `${kdtk}${tanggal}${prdcd}`;
            const noteData = {
              Cabang: cabang,
              unixKey,
              noteText: noteCategory || "",
              pic: pic,
              categoryId: codeCategory || null,
              tableName: tableName,
            };
            // call reuse logic
            const resultupdNote = await service.upsert(noteData);

            //convert categoryId to integer
            const strCategoryId = codeCategory ? parseInt(codeCategory) : null;

            let category = null;
            if (strCategoryId) {
              const categoryResult = await noteCategoriesService.getAll();
              const categories = categoryResult.data || [];
              category = categories.find(c => c.id === strCategoryId) || null;
            }

            const user = await userService.findByCredentials(pic);
            const rslt = { ...resultupdNote.toJSON(), category, fullName: user?.fullName || null };

            return apiResponse.success(res, {
              message: `Auto note processed successfully for ${kdtk}`,
              data: rslt,
            });
          } else {
            logger.info(`[autoNoteVirtMrg] No data found for the given parameters.`);
            return apiResponse.noContent(res, `Autonote: No data found for the given parameters.`);
          }
        }
      } else {
        logger.error(`[autoNoteVirtMrg] Failed to establish DB connection to store: ${storeInfo.storeCode}`);
        return apiResponse.error(`Failed to connect to store database`, 500);
      }
    } catch (error) {
      logger.error(`[autoNoteVirtMrg] error: ${error.message}`);
      return apiResponse.error(res, `Error`, 500);
    }
  } catch (error) {
    return apiResponse.error(res, error.message, 500);
  }
};
